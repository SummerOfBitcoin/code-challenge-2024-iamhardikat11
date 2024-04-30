## Block Program: Step-by-Step Approach

This document details the design and implementation of a program that constructs a valid Bitcoin block and stores the output in `output.txt`. Here's a breakdown of the process:

**1. Loading and Validating Transactions:**

  - The program starts by reading transactions from the mempool directory using the `fs` module.
  - Each transaction undergoes validation using the `validateTransaction` function. This function checks various aspects for validity, including:
      - Presence of input (`vin`) and output (`vout`) data.
      - Valid signatures and public keys associated with inputs.
      - Valid output values (greater than zero).

**2. Selecting Valid Transactions and Creating Coinbase:**

  - Only transactions passing validation are included in the final block.
  - A coinbase transaction is created to represent the block reward (currently set at 25 BTC) and total transaction fees.

**3. Calculating Fees and Constructing Block Header:**

  - The total transaction fee is calculated by summing inputs and subtracting outputs for each included transaction.
  - The `getBlockHeader` function is used to construct the block header, which contains essential information like:
      - Version number
      - Hash of the previous block
      - Merkle root (a hash representing all transactions in the block)
      - Timestamp
      - Difficulty target ("bits")
      - Nonce (used for mining)

**4. Mining the Block:**

  - The `mineBlock` function performs the Proof-of-Work (PoW) process. It continuously adjusts the `nonce` value in the block header until a hash is generated that meets the current difficulty target.

**5. Writing Output:**

  - Once mined, the final block data is written to a file named `output.txt`. 
  - This file includes:
      - The serialized block header string.
      - The serialized coinbase transaction string.
      - The serialized strings for each valid transaction included in the block.


## Implementation Details:

The provided pseudocode offers further insight into the specific functions used for each step. These functions handle tasks like:

* Loading transactions from the mempool.
* Validating individual transactions.
* Constructing the coinbase transaction with reward and fees.
* Creating the block header with different components.
* Performing the PoW mining process.
* Serializing and writing block data to a file.
