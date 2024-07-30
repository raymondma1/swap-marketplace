// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract OTCSwap is ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    struct Swap {
        uint256 swapId;
        address initiator;
        address counterparty;
        address tokenX;
        address tokenY;
        uint256 amountX;
        uint256 amountY;
        uint256 expiration;
    }

    mapping(bytes32 => bool) public executedSwaps;
    mapping(bytes32 => bool) public cancelledSwaps;

    event SwapExecuted(bytes32 indexed swapId);
    event SwapCancelled(bytes32 indexed swapId);

    constructor() EIP712("OTCSwap", "1") {}

    /**
     * @notice Executes a swap between two parties
     * @param _swap The swap details
     * @param _signature The signature of the initiator
     */
    function executeSwap(
        Swap calldata _swap,
        bytes calldata _signature
    ) external nonReentrant {
        bytes32 swapId = _hashSwap(_swap);
        address signer = _verify(_swap, _signature);

        require(signer == _swap.initiator, "Invalid signature");
        require(_swap.expiration > block.timestamp, "Swap expired");
        require(
            msg.sender == _swap.counterparty,
            "Only counterparty can execute"
        );
        require(!executedSwaps[swapId], "Swap already executed");
        require(!cancelledSwaps[swapId], "Swap has been cancelled");

        executedSwaps[swapId] = true;

        require(
            IERC20(_swap.tokenX).transferFrom(
                _swap.initiator,
                _swap.counterparty,
                _swap.amountX
            ),
            "Transfer of tokenX failed"
        );
        require(
            IERC20(_swap.tokenY).transferFrom(
                _swap.counterparty,
                _swap.initiator,
                _swap.amountY
            ),
            "Transfer of tokenY failed"
        );

        emit SwapExecuted(swapId);
    }

    /**
     * @notice Cancels a swap
     * @param _swap The swap details
     * @param _signature The signature of the initiator
     */
    function cancelSwap(
        Swap calldata _swap,
        bytes calldata _signature
    ) external nonReentrant {
        bytes32 swapId = _hashSwap(_swap);
        address signer = _verify(_swap, _signature);

        require(signer == _swap.initiator, "Invalid signature");
        require(msg.sender == _swap.initiator, "Only initiator can cancel");
        require(!executedSwaps[swapId], "Swap already executed");
        require(!cancelledSwaps[swapId], "Swap already cancelled");

        cancelledSwaps[swapId] = true;

        emit SwapCancelled(swapId);
    }

    /**
     * @notice Hashes the swap details
     * @param _swap The swap to hash
     * @return bytes32 The hash of the swap
     */
    function _hashSwap(Swap calldata _swap) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _swap.swapId,
                    _swap.initiator,
                    _swap.counterparty,
                    _swap.tokenX,
                    _swap.tokenY,
                    _swap.amountX,
                    _swap.amountY,
                    _swap.expiration
                )
            );
    }

    /**
     * @notice Verifies the signature of a swap
     * @param _swap The swap details
     * @param _signature The signature to verify
     * @return address The address that signed the swap
     */
    function _verify(
        Swap calldata _swap,
        bytes calldata _signature
    ) internal view returns (address) {
        bytes32 _structHash = keccak256(
            abi.encode(
                keccak256(
                    "Swap(uint256 swapId,address initiator,address counterparty,address tokenX,address tokenY,uint256 amountX,uint256 amountY,uint256 expiration)"
                ),
                _swap.swapId,
                _swap.initiator,
                _swap.counterparty,
                _swap.tokenX,
                _swap.tokenY,
                _swap.amountX,
                _swap.amountY,
                _swap.expiration
            )
        );
        return _hashTypedDataV4(_structHash).recover(_signature);
    }
}
