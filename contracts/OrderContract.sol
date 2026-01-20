// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract OrderTracking {
    enum Status {
        None,        // 0 (order not created)
        Created,     // 1
        Shipped,     // 2
        Delivered    // 3
    }

    struct Order {
        address buyer;
        address seller;
        address courier; // optional (0x0 if not assigned)
        Status status;
        uint256 createdAt;
    }

    mapping(uint256 => Order) private orders;

    event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed seller);
    event CourierSet(uint256 indexed orderId, address indexed courier);
    event Shipped(uint256 indexed orderId, address indexed actor);
    event Delivered(uint256 indexed orderId, address indexed actor);

    modifier orderExists(uint256 orderId) {
        require(orders[orderId].buyer != address(0), "Order not found");
        _;
    }

    modifier onlySellerOrCourier(uint256 orderId) {
        Order memory o = orders[orderId];
        require(
            msg.sender == o.seller || (o.courier != address(0) && msg.sender == o.courier),
            "Not seller/courier"
        );
        _;
    }

    modifier onlyCourierOrBuyer(uint256 orderId) {
        Order memory o = orders[orderId];
        require(
            msg.sender == o.buyer || (o.courier != address(0) && msg.sender == o.courier),
            "Not buyer/courier"
        );
        _;
    }

    /// @notice Create an order (platform/backend can call this, or you can allow buyers to call it)
    function createOrder(uint256 orderId, address buyer, address seller) external {
        require(orderId != 0, "Invalid orderId");
        require(buyer != address(0) && seller != address(0), "Invalid address");
        require(orders[orderId].buyer == address(0), "Order already exists");

        orders[orderId] = Order({
            buyer: buyer,
            seller: seller,
            courier: address(0),
            status: Status.Created,
            createdAt: block.timestamp
        });

        emit OrderCreated(orderId, buyer, seller);
    }

    /// @notice Assign courier who can confirm shipped/delivery (seller sets it here)
    function setCourier(uint256 orderId, address courier) external orderExists(orderId) {
        require(courier != address(0), "Invalid courier");
        // Optional restriction (uncomment if you want only seller to assign):
        // require(msg.sender == orders[orderId].seller, "Only seller can set courier");

        orders[orderId].courier = courier;
        emit CourierSet(orderId, courier);
    }

    /// ✅ confirmShipped(orderId): Seller/courier confirms item is shipped
    function confirmShipped(uint256 orderId) external orderExists(orderId) onlySellerOrCourier(orderId) {
        Order storage o = orders[orderId];
        require(o.status == Status.Created, "Order not in Created state");

        o.status = Status.Shipped;
        emit Shipped(orderId, msg.sender);
    }

    /// ✅ confirmDelivery(orderId): Courier or buyer confirms delivery
    function confirmDelivery(uint256 orderId) external orderExists(orderId) onlyCourierOrBuyer(orderId) {
        Order storage o = orders[orderId];
        require(o.status == Status.Shipped, "Order not in Shipped state");

        o.status = Status.Delivered;
        emit Delivered(orderId, msg.sender);
    }

    // -------- Read-only helpers --------

    function getOrderStatus(uint256 orderId) external view orderExists(orderId) returns (Status) {
        return orders[orderId].status;
    }

    function getOrder(uint256 orderId) external view orderExists(orderId) returns (
        address buyer,
        address seller,
        address courier,
        Status status,
        uint256 createdAt
    ) {
        Order memory o = orders[orderId];
        return (o.buyer, o.seller, o.courier, o.status, o.createdAt);
    }
}
