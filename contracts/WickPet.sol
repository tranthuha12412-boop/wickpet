// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  WickPet — an on-chain AI pet for every Agent ID
 * @author HTP96
 * @notice Every holder of an Agent ID (name.ai) can adopt exactly one pet.
 *         The pet must be fed and played with regularly. Leave it hungry for
 *         72 hours and it runs away from home. Friends can send treats to keep
 *         each other's pets alive.
 *
 * Safety / permissions disclosure (hackathon rules):
 *   - This contract has NO owner and NO admin functions.
 *   - It holds no tokens, accepts no BNB, never asks for approvals and never
 *     moves user assets. Every function is non-payable.
 *   - It cannot be paused, upgraded, or changed after deployment.
 *   - The only external call is a read-only `balanceOf` on the Agent ID contract.
 */

interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
}

contract WickPet {
    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    /// @notice SPACE ID Agent ID contract (ERC-721, non-transferable).
    IAgentID public immutable agentId;

    uint256 public constant FEED_COOLDOWN = 4 hours;
    uint256 public constant PLAY_COOLDOWN = 4 hours;
    uint256 public constant TREAT_COOLDOWN = 1 days; // per (giver, friend) pair
    uint256 public constant RUNAWAY_AFTER = 72 hours; // without food
    uint256 public constant BOREDOM_AFTER = 48 hours; // happiness hits 0
    uint256 public constant TREAT_FOOD = 12 hours; // how much hunger a treat removes

    uint32 public constant XP_FEED = 10;
    uint32 public constant XP_PLAY = 8;
    uint32 public constant XP_TREAT_RECEIVED = 5;
    uint32 public constant XP_TREAT_GIVEN = 3;
    uint32 public constant MAX_STREAK_BONUS = 10;

    uint8 public constant SPECIES_COUNT = 6; // 0 Bull, 1 Bear, 2 Whale, 3 Frog, 4 Cat, 5 Dragon

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    struct Pet {
        string name;
        uint8 species;
        uint32 generation; // increases every time a new pet is adopted after a runaway
        uint64 bornAt;
        uint64 lastFed;
        uint64 lastPlayed;
        uint32 xp;
        uint32 feeds;
        uint32 plays;
        uint32 treatsReceived;
        uint32 treatsGiven;
        uint32 streak; // consecutive days with at least one feed/play
        uint32 bestStreak;
        uint32 lastCareDay; // block.timestamp / 1 days
    }

    struct PetView {
        address keeper;
        string name;
        uint8 species;
        uint32 generation;
        uint64 bornAt;
        uint64 lastFed;
        uint64 lastPlayed;
        uint32 xp;
        uint32 level;
        uint8 stage; // 0 Egg, 1 Baby, 2 Teen, 3 Adult, 4 Legend
        uint8 hunger; // 0 (full) .. 100 (starving)
        uint8 happiness; // 0 .. 100
        bool ranAway;
        uint32 feeds;
        uint32 plays;
        uint32 treatsReceived;
        uint32 treatsGiven;
        uint32 streak;
        uint32 bestStreak;
        uint64 nextFeedAt;
        uint64 nextPlayAt;
    }

    mapping(address => Pet) private _pets;
    mapping(address => mapping(address => uint64)) public lastTreat; // giver => friend => time

    address[] private _keepers;
    mapping(address => bool) private _isKeeper;

    uint256 public totalAdoptions;
    uint256 public totalActions;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event Adopted(address indexed keeper, string name, uint8 species, uint32 generation);
    event Fed(address indexed keeper, uint32 xp, uint32 streak);
    event Played(address indexed keeper, uint32 xp, uint32 streak);
    event TreatSent(address indexed from, address indexed to);
    event CalledHome(address indexed keeper, uint32 xpAfter);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NoAgentID();
    error AlreadyHasPet();
    error NoPet();
    error PetRanAway();
    error PetIsHome();
    error TooSoon(uint256 readyAt);
    error BadName();
    error CannotTreatSelf();

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    constructor(address agentIdContract) {
        require(agentIdContract != address(0), "agentId=0");
        agentId = IAgentID(agentIdContract);
    }

    modifier onlyAgentHolder() {
        if (agentId.balanceOf(msg.sender) == 0) revert NoAgentID();
        _;
    }

    // ---------------------------------------------------------------------
    // Actions
    // ---------------------------------------------------------------------

    /// @notice Adopt a pet. One living pet per Agent ID holder.
    ///         If your previous pet ran away you can adopt a new one (next generation).
    function adopt(string calldata name) external onlyAgentHolder {
        Pet storage old = _pets[msg.sender];
        if (old.bornAt != 0 && !_ranAway(old)) revert AlreadyHasPet();
        _validateName(name);

        uint32 gen = old.generation + 1;
        uint8 species = uint8(
            uint256(keccak256(abi.encodePacked(msg.sender, block.prevrandao, block.timestamp, gen))) % SPECIES_COUNT
        );
        uint64 nowTs = uint64(block.timestamp);

        _pets[msg.sender] = Pet({
            name: name,
            species: species,
            generation: gen,
            bornAt: nowTs,
            lastFed: nowTs,
            lastPlayed: nowTs,
            xp: 0,
            feeds: 0,
            plays: 0,
            treatsReceived: 0,
            treatsGiven: 0,
            streak: 0,
            bestStreak: 0,
            lastCareDay: 0
        });

        if (!_isKeeper[msg.sender]) {
            _isKeeper[msg.sender] = true;
            _keepers.push(msg.sender);
        }
        totalAdoptions++;
        totalActions++;
        emit Adopted(msg.sender, name, species, gen);
    }

    /// @notice Feed your pet. Once every 4 hours.
    function feed() external onlyAgentHolder {
        Pet storage p = _livePet(msg.sender);
        uint256 readyAt = uint256(p.lastFed) + FEED_COOLDOWN;
        if (p.feeds > 0 && block.timestamp < readyAt) revert TooSoon(readyAt);

        p.lastFed = uint64(block.timestamp);
        p.feeds++;
        p.xp += XP_FEED + _care(p);
        totalActions++;
        emit Fed(msg.sender, p.xp, p.streak);
    }

    /// @notice Play with your pet. Once every 4 hours.
    function play() external onlyAgentHolder {
        Pet storage p = _livePet(msg.sender);
        uint256 readyAt = uint256(p.lastPlayed) + PLAY_COOLDOWN;
        if (p.plays > 0 && block.timestamp < readyAt) revert TooSoon(readyAt);

        p.lastPlayed = uint64(block.timestamp);
        p.plays++;
        p.xp += XP_PLAY + _care(p);
        totalActions++;
        emit Played(msg.sender, p.xp, p.streak);
    }

    /// @notice Send a treat to a friend's pet: removes 12h of hunger and gives XP to both.
    ///         Once per day per friend. You need your own living pet to send treats.
    function sendTreat(address friend) external onlyAgentHolder {
        if (friend == msg.sender) revert CannotTreatSelf();
        Pet storage mine = _livePet(msg.sender);
        Pet storage theirs = _livePet(friend);

        uint256 readyAt = uint256(lastTreat[msg.sender][friend]) + TREAT_COOLDOWN;
        if (lastTreat[msg.sender][friend] != 0 && block.timestamp < readyAt) revert TooSoon(readyAt);
        lastTreat[msg.sender][friend] = uint64(block.timestamp);

        uint256 fed = uint256(theirs.lastFed) + TREAT_FOOD;
        theirs.lastFed = uint64(fed > block.timestamp ? block.timestamp : fed);
        theirs.treatsReceived++;
        theirs.xp += XP_TREAT_RECEIVED;

        mine.treatsGiven++;
        mine.xp += XP_TREAT_GIVEN;

        totalActions++;
        emit TreatSent(msg.sender, friend);
    }

    /// @notice Your pet ran away? Call it home. It comes back, but loses half its XP
    ///         and its streak resets.
    function callHome() external onlyAgentHolder {
        Pet storage p = _pets[msg.sender];
        if (p.bornAt == 0) revert NoPet();
        if (!_ranAway(p)) revert PetIsHome();

        uint64 nowTs = uint64(block.timestamp);
        p.lastFed = nowTs;
        p.lastPlayed = nowTs;
        p.xp = p.xp / 2;
        p.streak = 0;
        totalActions++;
        emit CalledHome(msg.sender, p.xp);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function hasAgentId(address account) external view returns (bool) {
        return agentId.balanceOf(account) > 0;
    }

    function hasPet(address keeper) external view returns (bool) {
        return _pets[keeper].bornAt != 0;
    }

    function getPet(address keeper) public view returns (PetView memory v) {
        Pet storage p = _pets[keeper];
        if (p.bornAt == 0) revert NoPet();
        return _view(keeper, p);
    }

    function keeperCount() external view returns (uint256) {
        return _keepers.length;
    }

    /// @notice Paginated list of pets, for leaderboards.
    function getPets(uint256 offset, uint256 limit) external view returns (PetView[] memory list) {
        uint256 n = _keepers.length;
        if (offset >= n) return new PetView[](0);
        uint256 end = offset + limit;
        if (end > n) end = n;
        list = new PetView[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            address k = _keepers[i];
            list[i - offset] = _view(k, _pets[k]);
        }
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _livePet(address keeper) internal view returns (Pet storage p) {
        p = _pets[keeper];
        if (p.bornAt == 0) revert NoPet();
        if (_ranAway(p)) revert PetRanAway();
    }

    function _ranAway(Pet storage p) internal view returns (bool) {
        return block.timestamp > uint256(p.lastFed) + RUNAWAY_AFTER;
    }

    /// @dev Updates the daily care streak and returns bonus XP (only on the first care of a day).
    function _care(Pet storage p) internal returns (uint32 bonus) {
        uint32 today = uint32(block.timestamp / 1 days);
        if (p.lastCareDay == today) return 0;
        if (p.lastCareDay != 0 && p.lastCareDay + 1 == today) {
            p.streak += 1;
        } else {
            p.streak = 1;
        }
        p.lastCareDay = today;
        if (p.streak > p.bestStreak) p.bestStreak = p.streak;
        bonus = p.streak < MAX_STREAK_BONUS ? p.streak : MAX_STREAK_BONUS;
    }

    function _view(address keeper, Pet storage p) internal view returns (PetView memory v) {
        uint256 sinceFed = block.timestamp - p.lastFed;
        uint256 sincePlay = block.timestamp - p.lastPlayed;
        uint256 hunger = sinceFed >= RUNAWAY_AFTER ? 100 : (sinceFed * 100) / RUNAWAY_AFTER;
        uint256 boredom = sincePlay >= BOREDOM_AFTER ? 100 : (sincePlay * 100) / BOREDOM_AFTER;
        uint32 level = _level(p.xp);

        v.keeper = keeper;
        v.name = p.name;
        v.species = p.species;
        v.generation = p.generation;
        v.bornAt = p.bornAt;
        v.lastFed = p.lastFed;
        v.lastPlayed = p.lastPlayed;
        v.xp = p.xp;
        v.level = level;
        v.stage = _stage(p.xp, level);
        v.hunger = uint8(hunger);
        v.happiness = uint8(100 - boredom);
        v.ranAway = _ranAway(p);
        v.feeds = p.feeds;
        v.plays = p.plays;
        v.treatsReceived = p.treatsReceived;
        v.treatsGiven = p.treatsGiven;
        v.streak = p.streak;
        v.bestStreak = p.bestStreak;
        v.nextFeedAt = p.feeds == 0 ? p.bornAt : uint64(uint256(p.lastFed) + FEED_COOLDOWN);
        v.nextPlayAt = p.plays == 0 ? p.bornAt : uint64(uint256(p.lastPlayed) + PLAY_COOLDOWN);
    }

    /// @dev level = 1 + floor(sqrt(xp / 20))  → 20xp=L2, 80=L3, 180=L4, 320=L5, 500=L6, 1620=L10
    function _level(uint32 xp) internal pure returns (uint32) {
        return uint32(1 + _sqrt(uint256(xp) / 20));
    }

    /// @dev The egg hatches at 15 XP (first feed + play), then grows with level.
    function _stage(uint32 xp, uint32 level) internal pure returns (uint8) {
        if (xp < 15) return 0; // Egg
        if (level <= 3) return 1; // Baby
        if (level <= 6) return 2; // Teen
        if (level <= 9) return 3; // Adult
        return 4; // Legend
    }

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function _validateName(string calldata name) internal pure {
        bytes calldata b = bytes(name);
        if (b.length == 0 || b.length > 20) revert BadName();
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool ok = (c >= 0x30 && c <= 0x39) // 0-9
                || (c >= 0x41 && c <= 0x5A) // A-Z
                || (c >= 0x61 && c <= 0x7A) // a-z
                || c == 0x20 || c == 0x2D || c == 0x5F || c == 0x2E; // space - _ .
            if (!ok) revert BadName();
        }
    }
}
