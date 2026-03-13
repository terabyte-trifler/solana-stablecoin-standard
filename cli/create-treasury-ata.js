const {Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction} = require('@solana/web3.js');
const {createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID} = require('@solana/spl-token');
const fs = require('fs');
const os = require('os');
const path = require('path');

const connection = new Connection('http://127.0.0.1:8899', 'confirmed');
const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config/solana/id.json'), 'utf8')))
);

// CUSD mint from the seize test
const mint = new PublicKey('8pTQRL8vaidtcJQHYPtktLgmRXsnYLiZbcqXswLpAa5p');

// We need to figure out who owns 2RzFyYEf... 
// Let's derive what owner would produce that ATA
// Actually, let's just create the treasury ATA for the master authority
const treasuryOwner = new PublicKey('ANoJSqqxqih1kSkjYaRno9YeBMVaYB8gmcPnBdV5NqQJ');

console.log('Creating treasury ATA for:');
console.log('  Mint:', mint.toBase58());
console.log('  Owner:', treasuryOwner.toBase58());

const ata = getAssociatedTokenAddressSync(mint, treasuryOwner, false, TOKEN_2022_PROGRAM_ID);
console.log('  ATA will be:', ata.toBase58());

const ix = createAssociatedTokenAccountInstruction(
  payer.publicKey,
  ata,
  treasuryOwner,
  mint,
  TOKEN_2022_PROGRAM_ID
);

(async () => {
  try {
    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
    console.log('\n✓ Treasury ATA created successfully!');
    console.log('  Address:', ata.toBase58());
    console.log('  Signature:', sig);
  } catch (err) {
    console.error('\n✗ Failed to create ATA:', err.message);
    if (err.logs) {
      console.error('Logs:', err.logs);
    }
  }
})();
