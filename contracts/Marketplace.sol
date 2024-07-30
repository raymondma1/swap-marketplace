// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Marketplace is ReentrancyGuard {
    struct User {
        string username;
        bool isRegistered;
        uint256 balance;
    }

    struct Item {
        uint256 id;
        string name;
        string description;
        uint256 price;
        bool isAvailable;
        address owner;
    }

    mapping(address => User) public users;
    mapping(string => bool) public usernameExists;
    mapping(uint256 => Item) public items;
    uint256 public itemIds;

    event UserRegistered(address indexed userAddress, string username);
    event ItemListed(
        uint256 indexed itemId,
        string name,
        uint256 price,
        address indexed owner
    );
    event ItemSold(
        uint256 indexed itemId,
        address indexed seller,
        address indexed buyer,
        uint256 price
    );
    event FundsWithdrawn(address indexed user, uint256 amount);

    constructor() {}

    /**
     * @notice Modifier to ensure only registered users can access certain functions
     */
    modifier onlyRegistered() {
        require(users[msg.sender].isRegistered, "User not registered");
        _;
    }

    /**
     * @notice Registers a new user with a unique username
     * @param _username The desired username for the new user
     */
    function registerUser(string memory _username) external {
        require(!users[msg.sender].isRegistered, "User already registered");
        require(!usernameExists[_username], "Username already taken");

        users[msg.sender] = User(_username, true, 0);
        usernameExists[_username] = true;

        emit UserRegistered(msg.sender, _username);
    }

    /**
     * @notice Lists a new item for sale in the marketplace
     * @param _name Name of the item
     * @param _description Description of the item
     * @param _price Price of the item in wei
     */
    function listItem(
        string memory _name,
        string memory _description,
        uint256 _price
    ) external onlyRegistered {
        require(_price > 0, "Price must be greater than zero");

        itemIds++;
        uint256 newItemId = itemIds;

        items[newItemId] = Item(
            newItemId,
            _name,
            _description,
            _price,
            true,
            msg.sender
        );

        emit ItemListed(newItemId, _name, _price, msg.sender);
    }

    /**
     * @notice Allows a user to buy an item from the marketplace
     * @param _itemId ID of the item to be purchased
     */
    function buyItem(
        uint256 _itemId
    ) external payable nonReentrant onlyRegistered {
        Item storage item = items[_itemId];
        require(item.isAvailable, "Item is not available");
        require(item.owner != msg.sender, "Cannot buy your own item");
        require(msg.value == item.price, "Incorrect ETH amount sent");

        item.isAvailable = false;
        address seller = item.owner;
        item.owner = msg.sender;

        users[seller].balance += item.price;

        emit ItemSold(_itemId, seller, msg.sender, item.price);
    }

    /**
     * @notice Retrieves the details of a specific item
     * @param _itemId ID of the item to retrieve
     * @return Item struct containing the item's details
     */
    function getItem(uint256 _itemId) external view returns (Item memory) {
        return items[_itemId];
    }

    /**
     * @notice Allows a user to withdraw their accumulated balance from sales
     */
    function withdrawFunds() external nonReentrant onlyRegistered {
        uint256 amount = users[msg.sender].balance;
        require(amount > 0, "No funds to withdraw");

        users[msg.sender].balance = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit FundsWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Allows the contract to receive ETH
     */
    receive() external payable {}
}
