const forge = require('node-forge');
const fs = require('fs');
const path = require('node:path');
const uuidv4 = require('uuid').v4;

function generateCerts(commonName , domainNames , outRootCaCertPath , outRootCaKeyPath , outServerCertPath , outServerKeyPath) {
    if ( ! isArray(domainNames) ) domainNames = [domainNames];

    const pki = forge.pki;

    // --- 1. Generate Root CA Keypair and Certificate ---
    const rootKeys = pki.rsa.generateKeyPair(2048);
    const rootCert = pki.createCertificate();
    rootCert.publicKey = rootKeys.publicKey;
    rootCert.serialNumber = '01';
    rootCert.validity.notBefore = new Date();
    rootCert.validity.notAfter = new Date();
    rootCert.validity.notAfter.setFullYear(rootCert.validity.notBefore.getFullYear() + 99);

    const rootAttrs = [
        {name : 'commonName' , value : 'User-script server'} ,
        {name : 'countryName' , value : 'US'} ,
        {shortName : 'ST' , value : 'CA'} ,
        {name : 'localityName' , value : 'San Francisco'} ,
        {name : 'organizationName' , value : 'Example Co'} ,
        {shortName : 'OU' , value : 'CA Unit'}
    ];

    rootCert.setSubject(rootAttrs);
    rootCert.setIssuer(rootAttrs);
    rootCert.setExtensions([
        {name : 'basicConstraints' , cA : true} ,
        {name : 'keyUsage' , keyCertSign : true , digitalSignature : true , cRLSign : true} ,
        {name : 'subjectKeyIdentifier'}
    ]);

    // Self-sign root cert
    rootCert.sign(rootKeys.privateKey , forge.md.sha256.create());

    // --- 2. Generate Server Keypair and Certificate ---
    const serverKeys = pki.rsa.generateKeyPair(2048);
    const serverCert = pki.createCertificate();
    serverCert.publicKey = serverKeys.publicKey;
    serverCert.serialNumber = '02';
    serverCert.validity.notBefore = new Date();
    serverCert.validity.notAfter = new Date();
    serverCert.validity.notAfter.setFullYear(serverCert.validity.notBefore.getFullYear() + 2);

    const serverAttrs = [
        {name : 'commonName' , value : domainNames[0]}
    ];

    serverCert.setSubject(serverAttrs);
    serverCert.setIssuer(rootCert.subject.attributes);
    serverCert.setExtensions([
        {name : 'basicConstraints' , cA : false} ,
        {name : 'keyUsage' , digitalSignature : true , keyEncipherment : true} ,
        {
            name : 'subjectAltName' ,
            altNames : domainNames.map(d => ({
                type : 2 , // DNS name
                value : d
            }))
        }
    ]);

    // Sign server cert with root CA private key
    serverCert.sign(rootKeys.privateKey , forge.md.sha256.create());

    // --- 3. Convert and Write to Files (PEM, no password protection) ---
    const rootCertPem = pki.certificateToPem(rootCert);
    const rootKeyPem = pki.privateKeyToPem(rootKeys.privateKey);
    const serverCertPem = pki.certificateToPem(serverCert);
    const serverKeyPem = pki.privateKeyToPem(serverKeys.privateKey);

    fs.writeFileSync(outRootCaCertPath , rootCertPem);
    fs.writeFileSync(outRootCaKeyPath , rootKeyPem);
    fs.writeFileSync(outServerCertPath , serverCertPem);
    fs.writeFileSync(outServerKeyPath , serverKeyPem);

    console.log('Certificates generated successfully.');
}

function certToBase64DER(pem) {
    const cert = forge.pki.certificateFromPem(pem);
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const derBuffer = Buffer.from(der , 'binary');
    return derBuffer.toString('base64').match(/.{1,64}/g).join('\n'); // wrap lines
}

function generateMobileconfig(caCertPath , serverCertPath , outMobileconfigPath) {
    const caCertPem = fs.readFileSync(caCertPath , 'utf8');
    const serverCertPem = fs.readFileSync(serverCertPath , 'utf8');

    const caCertBase64 = certToBase64DER(caCertPem);
    const serverCertBase64 = certToBase64DER(serverCertPem);

    const uuidPayload = uuidv4();
    const uuidCa = uuidv4();
    const uuidServer = uuidv4();

    const profile = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
 "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadDisplayName</key>
  <string>User-script server Certificates</string>
  <key>PayloadIdentifier</key>
  <string>cocoa.userscript-server.certs.mobileconfig</string>
  <key>PayloadUUID</key>
  <string>${uuidPayload}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.security.root</string>
      <key>PayloadDisplayName</key>
      <string>Root CA Certificate</string>
      <key>PayloadIdentifier</key>
      <string>cocoa.userscript-server.certs.root-ca</string>
      <key>PayloadUUID</key>
      <string>${uuidCa}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadContent</key>
      <data>
      ${caCertBase64}
      </data>
    </dict>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.security.pkcs1</string>
      <key>PayloadDisplayName</key>
      <string>Server Certificate</string>
      <key>PayloadIdentifier</key>
      <string>cocoa.userscript-server.certs.server</string>
      <key>PayloadUUID</key>
      <string>${uuidServer}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadContent</key>
      <data>
      ${serverCertBase64}
      </data>
    </dict>
  </array>
</dict>
</plist>`;

    fs.writeFileSync(outMobileconfigPath , profile);
    console.log('Mobile profile generated successfully.');
}

module.exports = {generateCerts, generateMobileconfig};
