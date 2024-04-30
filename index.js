const fs = require('fs');
const crypto = require('crypto');
const secp256k1 = require('secp256k1');
const diff_target = '0x0000ffff000000000000000000000000000000000000000000000000000000000';
const output_file_name = 'output.txt';
const mempool_path = './mempool';

// Utility functions
// function Block_Header_to_Text(block_header) { return `${block_header.version} ${block_header.prevBlockHash} ${block_header.merkleRoot} ${block_header.timestamp} ${block_header.bits} ${block_header.nonce}`; }
function Block_Header_to_Text(block_header) {
    const version = block_header.version.toString(16).padStart(8, '0'); // Convert version to hex with leading zeros
    const prevBlockHash = block_header.prevBlockHash.padEnd(64, ' '); // Ensure previous block hash is 32 bytes (64 characters)
    const merkleRoot = block_header.merkleRoot.padEnd(64, ' '); // Ensure merkle root is 32 bytes (64 characters)
    const timestamp = block_header.timestamp.toString(16).padStart(8, '0'); // Convert timestamp to hex with leading zeros
    const bits = block_header.bits.padStart(8, '0'); // Ensure bits is 4 bytes (8 characters)
    const nonce = block_header.nonce.toString(16).padStart(8, '0'); // Convert nonce to hex with leading zeros

    // Ensure total length is 80 bytes (160 characters)
    const formattedString = `0x${version}`+
                             `${prevBlockHash}`+
                             `${merkleRoot}` +
                             `0x${timestamp}`+
                             `${bits}` +
                             `0x${nonce}`;

    return formattedString;
}


function Transaction_to_Text(trs) { return JSON.stringify(trs); }

function Merkle_Gen(trs) {
    const all_hashes = trs.map(trs => {
      const tx_hash = crypto.createHash('sha256');
      tx_hash.update(Transaction_to_Text(trs));
      return tx_hash.digest('hex');
    });
    function Merkle_Root(hash_arr) {
      if (hash_arr.length === 1) 
        return hash_arr[0];
      const new_hash_ = [];
      let i = 0;
      while(i < hash_arr.length) {
        const combined_hash = crypto.createHash('sha256');
        combined_hash.update(Buffer.concat([Buffer.from(hash_arr[i], 'hex'), Buffer.from(hash_arr[i + 1] || hash_arr[i], 'hex')]));
        new_hash_.push(combined_hash.digest('hex'));
        i = i+2;
      }
      return Merkle_Root(new_hash_);
    }
    return Merkle_Root(all_hashes);
}

function transaction_validator(trs) {
    // Initial Check for each Transaction JSON to confirm having a legitimate vin and vout
    if (!trs.vin || trs.vin.length === 0 ||!trs.vout || trs.vout.length === 0) return false;
    // Verify each Transaction JSON's Signature
    trs.vin.forEach(input => {
      const script_sign = input.scriptSig;
      const script_public_key = input.prevout.scriptPubKey;
      const trs_prev_id = input.prevout.txid;
      if (!trs_prev_id) return false;
      const msg_hash = crypto.createHash('sha256');
      msg_hash.update(trs_prev_id);
      const public_key = public_key_recovery_proto(msg_hash.digest(), script_sign);
      const flag = secp256k1.verify(msg_hash.digest(), script_sign, public_key);
      if (!flag) return false;
    });
    // Validate Each Transaction Output
    trs.vout.forEach(output => { if (output.value <= 0) return false;});
    return true;
}

function Block_Hash_Getter(block_header) {
    const block_header_Buffer = Buffer.concat([Buffer.from(block_header.version.toString(), 'hex'), Buffer.from(block_header.prevBlockHash, 'hex'), Buffer.from(block_header.merkleRoot, 'hex'), Buffer.from(block_header.timestamp.toString(), 'hex'), Buffer.from(block_header.bits, 'hex'), Buffer.from(block_header.nonce.toString(), 'hex')]);
    const block_hash = crypto.createHash('sha256');
    block_hash.update(block_header_Buffer);
    return crypto.createHash('sha256').update(block_hash.digest()).digest('hex');
}

function public_key_recovery_proto(messageHash, sign) {
    const recovered_key = [];
    const secp256k1_n = BigInt('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
    const r = BigInt(Buffer.from(sign, 'hex').slice(0, 32).toString('hex'));
    const recovery_id = Buffer.from(sign, 'hex')[64];
    const pub_key = secp256k1.publicKeyCreate(Buffer.from('00', 'hex'));
    const pub_key_point = secp256k1.publicKeyTweakAdd(pub_key, recovery_id === 27 ? secp256k1_n - r : r);
    recovered_key.push(pub_key_point);
    return recovered_key;
}

// From the Input Directory load all the transactions
function loadTransactions() {
    let operations = []
    fs.readdirSync(mempool_path).forEach(file => {
        const relative_file_path = `${mempool_path}/${file}`;
        const trs = JSON.parse(fs.readFileSync(relative_file_path, 'utf8'));
        operations.push(trs);
    });
    return operations;
}

const operations = loadTransactions();
// Validating all transactions on the block
const valid_Operations = [];
operations.forEach(trs => { if (transaction_validator(trs)) { valid_Operations.push(trs); } });

// Calculating Total Transactions Fee / Cost
let total_fee = 0;
valid_Operations.forEach(trs => {
    trs.vin.forEach(input => { total_fee += input.prevout.value; });
    trs.vout.forEach(output => { total_fee -= output.value; });
});

// Creating the JSON Type Object for Coinbase Transaction
function create_Coinbase_Transaction() {
    const cb_Trs = {
        version: 1,
        locktime: 0,
        vin: [{
            prevout: {
            txid: '0000000000000000000000000000000000000000000000000000000000000000',
            value: total_fee + 2500000 // total transaction fees + 25 BTC reward
            }
        }],
        vout: [
            {
            scriptpubkey: '76a9146085312a9c500ff9cc35b571b0a1e5efb7fb9f1688ac',
            scriptpubkey_asm: 'OP_DUP OP_HASH160 OP_PUSHBYTES_20 6085312a9c500ff9cc35b571b0a1e5efb7fb9f16 OP_EQUALVERIFY OP_CHECKSIG',
            scriptpubkey_type: 'p2pkh',
            scriptpubkey_address: '19oMRmCWMYuhnP5W61ABrjjxHc6RphZh11',
            value: 0
            }
        ]
    };
    return cb_Trs;
}

// Creating the JSON Type Object for Block Header
function constructBlockHeader() {
    const b_h = {
        version: 1,
        prevBlockHash: '0000000000000000000000000000000000000000000000000000000000000000',
        merkleRoot: Merkle_Gen(valid_Operations.concat([coinbase_Transaction])),
        timestamp: Math.floor(Date.now() / 1000),
        bits: "0000ffff00000000000000000000000000000000000000000000000000000000", // difficulty target
        nonce: 0
    };
    return b_h;
}
const coinbase_Transaction = create_Coinbase_Transaction()
const block_Header = constructBlockHeader()
let block_hash = crypto.createHash('sha256');
do {
  block_hash = Block_Hash_Getter(block_Header);
  block_Header.nonce++;
} while (block_hash > diff_target);

const rel_output_file_path = output_file_name;
fs.writeFileSync(rel_output_file_path, `${Block_Header_to_Text(block_Header)}\n`);
fs.appendFileSync(rel_output_file_path, `${Transaction_to_Text(coinbase_Transaction)}\n`);
valid_Operations.forEach(trs => { fs.appendFileSync(rel_output_file_path, `${Transaction_to_Text(trs)}\n`); });