/*
I declare that this code was written by me.
I will not copy or allow others to copy my code.
I understand that copying code is considered as plagiarism.

Student Name: Saw Kaung Khant Thiha
Student ID: 24025215
Class: C372-003
Date created: 16/01/2026
*/

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Payment_escrow.sol";

interface IOrderTracking {
    enum Status {
        None,
        Created,
        Shipped,
        Delivered
    }

    function getOrderStatus(uint256 orderId) external view returns (Status);
    function getOrder(uint256 orderId) external view returns (
        address buyer,
        address seller,
        address courier,
        Status status,
        uint256 createdAt
    );
}

contract OnlineStoreDisputes is EscrowPayment {

    // Who can resolve disputes
    address public arbitrator;
    IOrderTracking public orderTracking;

    constructor() EscrowPayment() {
        arbitrator = msg.sender;
        nextOrderId = 1;
    }

    function setOrderTracking(address orderTrackingAddress) external onlyOwner {
        require(orderTrackingAddress != address(0), "Invalid order tracking address");
        orderTracking = IOrderTracking(orderTrackingAddress);
    }

    function changeArbitrator(address newArbitrator) public {
        require(msg.sender == arbitrator, "Only arbitrator can change arbitrator");
        require(newArbitrator != address(0), "Invalid arbitrator");
        arbitrator = newArbitrator;
    }

    enum OrderStatus {
        None,
        Paid,
        Disputed,
        Resolved
    }

    enum DisputeOutcome {
        None,
        RefundBuyer,
        ReleaseToSeller
    }

    struct Order {
        address buyer;
        address seller;
        uint256 amount;     // ETH amount (in wei)
        OrderStatus status;
        bool payoutDone;
    }

    struct Dispute {
        bool exists;
        address openedBy;
        string reason;
        DisputeOutcome outcome;
    }

    mapping(uint256 => Order) public orders;
    mapping(uint256 => Dispute) public disputes;
    uint256 public nextOrderId;

    event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 amount);
    event DisputeRaised(uint256 indexed orderId, address indexed openedBy, string reason);
    event DisputeResolved(uint256 indexed orderId, DisputeOutcome outcome);
    event OrderCompleted(uint256 indexed orderId);

    /*
      Buyer creates order AND locks ETH into escrow in one step.

      Important:
      - Buyer must send ETH equal to `amount` as msg.value.
    */
    function createOrder(address seller, uint256 amount) public payable returns (uint256) {
        require(seller != address(0), "Invalid seller");
        require(amount > 0, "Amount must be > 0");

        uint256 orderId = nextOrderId;
        nextOrderId = nextOrderId + 1;

        _lockEscrow(orderId, msg.sender, seller, amount);

        orders[orderId] = Order(
            msg.sender,
            seller,
            amount,
            OrderStatus.Paid,
            false
        );

        emit OrderCreated(orderId, msg.sender, seller, amount);
        return orderId;
    }

    // Buyer OR seller can open a dispute
    function raiseDispute(uint256 orderId, string memory reason) public {
        Order storage order = orders[orderId];

        require(order.status == OrderStatus.Paid, "Order not in a disputable state");
        require(msg.sender == order.buyer || msg.sender == order.seller, "Not buyer or seller");
        require(disputes[orderId].exists == false, "Dispute already exists");

        disputes[orderId] = Dispute(
            true,
            msg.sender,
            reason,
            DisputeOutcome.None
        );

        order.status = OrderStatus.Disputed;

        emit DisputeRaised(orderId, msg.sender, reason);
    }

    /*
      Arbitrator resolves dispute.

      outcome values:
      - DisputeOutcome.RefundBuyer (1)
      - DisputeOutcome.ReleaseToSeller (2)
    */
    function resolveDispute(uint256 orderId, DisputeOutcome outcome) public {
        require(msg.sender == arbitrator, "Only arbitrator can resolve");

        Order storage order = orders[orderId];
        Dispute storage dispute = disputes[orderId];

        require(order.status == OrderStatus.Disputed, "Order not disputed");
        require(dispute.exists == true, "No dispute found");
        require(order.payoutDone == false, "Payout already done");

        // Only allow 2 valid outcomes (no if/else needed)
        require(outcome == DisputeOutcome.RefundBuyer || outcome == DisputeOutcome.ReleaseToSeller, "Invalid outcome");

        dispute.outcome = outcome;
        order.status = OrderStatus.Resolved;
        order.payoutDone = true;

        if (outcome == DisputeOutcome.RefundBuyer) {
            // Dispute resolved in favor of buyer: no platform fee on refund.
            _refundEscrow(orderId);
        }

        if (outcome == DisputeOutcome.ReleaseToSeller) {
            _requireDelivered(orderId);
            _releaseEscrow(orderId);
        }

        emit DisputeResolved(orderId, outcome);
    }

    // Buyer confirms successful delivery; releases escrow to seller.
    function completeOrder(uint256 orderId) public {
        Order storage order = orders[orderId];

        require(
            msg.sender == order.buyer || msg.sender == order.seller || _isCourier(orderId, msg.sender),
            "Only buyer/seller/courier can complete"
        );
        require(order.status == OrderStatus.Paid, "Order not in Paid state");
        require(disputes[orderId].exists == false, "Dispute already exists");
        require(order.payoutDone == false, "Payout already done");

        order.status = OrderStatus.Resolved;
        order.payoutDone = true;

        _requireDelivered(orderId);
        _releaseEscrow(orderId);
        emit OrderCompleted(orderId);
    }

    function canRaiseDispute(uint256 orderId, address user) public view returns (bool) {
        Order storage order = orders[orderId];

        bool isParty = (user == order.buyer) || (user == order.seller);
        bool isPaid = (order.status == OrderStatus.Paid);
        bool noDisputeYet = (disputes[orderId].exists == false);

        return isParty && isPaid && noDisputeYet;
    }

    function _requireDelivered(uint256 orderId) internal view {
        require(address(orderTracking) != address(0), "Order tracking not set");
        require(orderTracking.getOrderStatus(orderId) == IOrderTracking.Status.Delivered, "Order not delivered");
    }

    function _isCourier(uint256 orderId, address user) internal view returns (bool) {
        if (address(orderTracking) == address(0)) {
            return false;
        }

        (, , address courier, ,) = orderTracking.getOrder(orderId);
        return courier != address(0) && user == courier;
    }
}
