const fs = require('fs');
const crypto = require('crypto');
const base64url = require('base64url');

// Load private keys
let bkashPrivateKey;
let nagadPrivateKey;

try {
  bkashPrivateKey = fs.readFileSync('./keys/bkash-private.pem', 'utf8');
  nagadPrivateKey = fs.readFileSync('./keys/nagad-private.pem', 'utf8');
  console.log('✅ Private keys loaded successfully');
} catch (error) {
  console.error('❌ Error loading private keys:', error.message);
}

function generateJWSSignature(body, httpMethod, uri, source, destination, date) {
  try {
    // Select private key
    let privateKey;
    if (source === 'bKash') {
      privateKey = bkashPrivateKey;
    } else if (source === 'Nagad') {
      privateKey = nagadPrivateKey;
    } else {
      throw new Error(`Unknown FSP: ${source}`);
    }

    if (!privateKey) {
      throw new Error(`Private key not loaded for ${source}`);
    }

    // Create protected header
    const protectedHeader = {
      alg: "RS256",
      "FSPIOP-URI": uri,
      "FSPIOP-HTTP-Method": httpMethod,
      "FSPIOP-Source": source,
      "FSPIOP-Destination": destination,
      "Date": date
    };

    const encodedProtectedHeader = base64url(JSON.stringify(protectedHeader));

    // Hash the body
    const bodyString = JSON.stringify(body);
    const bodyHash = crypto.createHash('sha256').update(bodyString).digest();
    const encodedPayload = base64url(bodyHash);

    // Create signing input
    const signingInput = `${encodedProtectedHeader}.${encodedPayload}`;

    // Sign with RSA-SHA256
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signingInput);
    sign.end();
    
    const signature = sign.sign(privateKey);
    const encodedSignature = base64url(signature);

    const jwsSignature = JSON.stringify({
      signature: encodedSignature,
      protectedHeader: encodedProtectedHeader
    });

    console.log(`✅ JWS Signature generated for ${source}`);
    
    return jwsSignature;

  } catch (error) {
    console.error("❌ Error generating JWS signature:", error.message);
    throw error;
  }
}

module.exports = { generateJWSSignature };