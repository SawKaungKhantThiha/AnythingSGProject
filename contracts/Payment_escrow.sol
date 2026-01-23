/*
I declare that this code was written by me.
I will not copy or allow others to copy my code.
I understand that copying code is considered as plagiarism.

Student Name: Tay Yu Cheng
Student ID: 24026492
Class: C372-003
Date created: 16/01/2026
*/

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

abstract contract EscrowPayment {
    address payable public owner;

    enum EscrowStatus { None, Locked, Released, Refunded }

    struct Escrow {
        address buyer;
        address seller;
        uint256 amount;
        uint256 feeBPAtLock;
        EscrowStatus status;
    }

    event PlatformFeeCollected(uint256 indexed orderId, uint256 feeAmount, uint256 orderAmount, address indexed seller);
    event PlatformFeeUpdated(uint256 previousFeeBP, uint256 newFeeBP);
    event PlatformFeesWithdrawn(uint256 amount, address indexed to);

    // Mapping of orderId to Escrow struct stored in permanent blockchain storage
    mapping(uint256 => Escrow) public escrows;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not platform owner");
        _;
    }

    constructor() {
        owner = payable(msg.sender);
    }

    // Locks ETH from buyer into escrow
    function _lockEscrow(uint256 orderId, address buyer, address seller, uint256 amount) internal {
        require(buyer != address(0), "Invalid buyer address");
        require(seller != address(0), "Invalid seller address");
        require(amount > 0, "Amount must be greater than 0");
        require(msg.value == amount, "Incorrect ETH amount");

        Escrow storage escrow = escrows[orderId];
        require(escrow.status == EscrowStatus.None, "Escrow already exists");

        escrows[orderId] = Escrow({
            buyer: buyer,
            seller: seller,
            amount: amount,
            // Fee rate is locked at escrow creation; changes apply only to new escrows.
            feeBPAtLock: platformFeeBP,
            status: EscrowStatus.Locked
        });
    }

    // Releases funds to seller after confirmation
    function _releaseEscrow(uint256 orderId) internal {
        Escrow storage escrow = escrows[orderId];
        require(escrow.status == EscrowStatus.Locked, "Escrow not locked");

        // Platform fee is success-only: calculated only when escrow is released.
        // Seller bears the platform fee; buyer pays only the listed price (escrow.amount).
        // Fee supports platform sustainability: infrastructure, dispute handling, and operations.
        uint256 fee = (escrow.amount * escrow.feeBPAtLock) / 10000;
        require(escrow.amount >= fee, "Fee exceeds amount");
        uint256 payout = escrow.amount - fee;

        escrow.status = EscrowStatus.Released;
        if (fee > 0) {
            platformBalance += fee;
            emit PlatformFeeCollected(orderId, fee, escrow.amount, escrow.seller);
        }

        if (payout > 0) {
            (bool success, ) = payable(escrow.seller).call{value: payout}("");
            require(success, "ETH release failed");
        }
    }

    // Refunds buyer if necessary (no platform fee on refunds)
    function _refundEscrow(uint256 orderId) internal {
        Escrow storage escrow = escrows[orderId];
        require(escrow.status == EscrowStatus.Locked, "Escrow not locked");

        // No platform fee on disputes resolved in favor of buyers.
        escrow.status = EscrowStatus.Refunded;
        (bool success, ) = payable(escrow.buyer).call{value: escrow.amount}("");
        require(success, "ETH refund failed");
    }

    // Read-only: returns full escrow info
    function getEscrow(uint256 orderId) external view returns (address, address, uint256, EscrowStatus) {
        Escrow storage escrow = escrows[orderId];
        return (escrow.buyer, escrow.seller, escrow.amount, escrow.status);
    }

    // =====================================================
    // PLATFORM FEE LOGIC – CONTRIBUTED BY XU MANNI
    // =====================================================

    // Platform fee in basis points (e.g. 200 = 2%)
    uint256 public platformFeeBP = 200;

    // Accumulated platform earnings (platform-owned revenue, not user escrowed funds)
    uint256 public platformBalance;

    // Allows platform owner to update fee percentage
    function setPlatformFee(uint256 _feeBP) external onlyOwner {
        // Governance cap: max 5% (500 bp) to protect sellers and prevent abuse.
        require(_feeBP <= 500, "Fee too high");
        uint256 previousFeeBP = platformFeeBP;
        platformFeeBP = _feeBP;
        emit PlatformFeeUpdated(previousFeeBP, _feeBP);
    }

    // Calculates platform fee for a given transaction amount
    function calculatePlatformFee(uint256 amount) public view returns (uint256) {
        return (amount * platformFeeBP) / 10000;
    }

    // Allows platform owner to withdraw accumulated platform fees
    // Only platform fees can be withdrawn; active escrow balances are never touched.
    function withdrawPlatformFees() external onlyOwner {
        require(platformBalance > 0, "No platform fees");

        // Single-purpose withdrawal: platform owner withdraws platform revenue only.
        uint256 amount = platformBalance;
        platformBalance = 0;

        (bool success, ) = owner.call{value: amount}("");
        require(success, "Platform withdrawal failed");
        emit PlatformFeesWithdrawn(amount, owner);
    }
}
