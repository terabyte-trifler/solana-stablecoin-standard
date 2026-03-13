const { PublicKey } = require('@solana/web3.js');

// Source token account data
const sourceData = Buffer.from('1KnBeq05ndILTOpXaaYUpo3HAF4l0NmhaQUrLwxsF+Y7LNGtWHf2CFerY9mTCPoQL4lAbdRYWC5G9SVJK7HzbmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgcAAAAPAAEAAA==', 'base64');

// Destination token account data
const destData = Buffer.from('1KnBeq05ndILTOpXaaYUpo3HAF4l0NmhaQUrLwxsF+Zv+uIzbOj0RQn0z1yrDsyB3W5gPk3nuqGAoh/PgUoXYQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgcAAAAPAAEAAA==', 'base64');

// Extract owner pubkeys (bytes 32-64)
const sourceOwner = new PublicKey(sourceData.subarray(32, 64));
const destOwner = new PublicKey(destData.subarray(32, 64));

console.log('Source token account: 3FsCMGg51ZRNq95xGQ7CpRsnrZ4RisXUqkM4nMCce43E');
console.log('Source owner:', sourceOwner.toBase58());
console.log('');
console.log('Destination token account: ASjqDJXwtzo3UrhW5VvUZ1iphS76j5VGgqTH9gMqn8CP');
console.log('Destination owner:', destOwner.toBase58());
