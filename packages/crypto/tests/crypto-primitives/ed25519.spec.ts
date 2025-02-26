import chai, { expect } from 'chai';
import { Convert } from '@web5/common';
import chaiAsPromised from 'chai-as-promised';

import type { JwkParamsOkpPrivate, PrivateKeyJwk, PublicKeyJwk } from '../../src/jose.js';

import ed25519Sign from '../fixtures/test-vectors/ed25519/sign.json' assert { type: 'json' };
import ed25519Verify from '../fixtures/test-vectors/ed25519/verify.json' assert { type: 'json' };
import ed25519ComputePublicKey from '../fixtures/test-vectors/ed25519/compute-public-key.json' assert { type: 'json' };
import ed25519BytesToPublicKey from '../fixtures/test-vectors/ed25519/bytes-to-public-key.json' assert { type: 'json' };
import ed25519PublicKeyToBytes from '../fixtures/test-vectors/ed25519/public-key-to-bytes.json' assert { type: 'json' };
import ed25519BytesToPrivateKey from '../fixtures/test-vectors/ed25519/bytes-to-private-key.json' assert { type: 'json' };
import ed25519PrivateKeyToBytes from '../fixtures/test-vectors/ed25519/private-key-to-bytes.json' assert { type: 'json' };
import ed25519ConvertPublicKeyToX25519 from '../fixtures/test-vectors/ed25519/convert-public-key-to-x25519.json' assert { type: 'json' };
import ed25519ConvertPrivateKeyToX25519 from '../fixtures/test-vectors/ed25519/convert-private-key-to-x25519.json' assert { type: 'json' };

import { Ed25519 } from '../../src/crypto-primitives/ed25519.js';

chai.use(chaiAsPromised);

// NOTE: @noble/secp256k1 requires globalThis.crypto polyfill for node.js <=18: https://github.com/paulmillr/noble-secp256k1/blob/main/README.md#usage
// Remove when we move off of node.js v18 to v20, earliest possible time would be Oct 2023: https://github.com/nodejs/release#release-schedule
import { webcrypto } from 'node:crypto';
// @ts-ignore
if (!globalThis.crypto) globalThis.crypto = webcrypto;

describe('Ed25519', () => {
  let privateKey: PrivateKeyJwk;
  let publicKey: PublicKeyJwk;

  before(async () => {
    privateKey = await Ed25519.generateKey();
    publicKey = await Ed25519.computePublicKey({ privateKey });
  });

  describe('bytesToPrivateKey()', () => {
    it('returns a private key in JWK format', async () => {
      const privateKeyBytes = Convert.hex('4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb').toUint8Array();
      const privateKey = await Ed25519.bytesToPrivateKey({ privateKeyBytes });

      expect(privateKey).to.have.property('crv', 'Ed25519');
      expect(privateKey).to.have.property('d');
      expect(privateKey).to.have.property('kid');
      expect(privateKey).to.have.property('kty', 'OKP');
      expect(privateKey).to.have.property('x');
    });

    for (const vector of ed25519BytesToPrivateKey.vectors) {
      it(vector.description, async () => {
        const privateKey = await Ed25519.bytesToPrivateKey({
          privateKeyBytes: Convert.hex(vector.input.privateKeyBytes).toUint8Array()
        });
        expect(privateKey).to.deep.equal(vector.output);
      });
    }
  });

  describe('bytesToPublicKey()', () => {
    it('returns a public key in JWK format', async () => {
      const publicKeyBytes = Convert.hex('3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c').toUint8Array();
      const publicKey = await Ed25519.bytesToPublicKey({ publicKeyBytes });

      expect(publicKey).to.have.property('crv', 'Ed25519');
      expect(publicKey).to.have.property('kid');
      expect(publicKey).to.have.property('kty', 'OKP');
      expect(publicKey).to.have.property('x');
      expect(publicKey).to.not.have.property('d');
    });

    for (const vector of ed25519BytesToPublicKey.vectors) {
      it(vector.description, async () => {
        const publicKey = await Ed25519.bytesToPublicKey({
          publicKeyBytes: Convert.hex(vector.input.publicKeyBytes).toUint8Array()
        });
        expect(publicKey).to.deep.equal(vector.output);
      });
    }
  });

  describe('computePublicKey()', () => {
    it('returns a public key in JWK format', async () => {
      const publicKey = await Ed25519.computePublicKey({ privateKey });

      expect(publicKey).to.have.property('kty', 'OKP');
      expect(publicKey).to.have.property('crv', 'Ed25519');
      expect(publicKey).to.have.property('x');
      expect(publicKey).to.not.have.property('d');
    });

    for (const vector of ed25519ComputePublicKey.vectors) {
      it(vector.description, async () => {
        const publicKey = await Ed25519.computePublicKey(vector.input as { privateKey: PrivateKeyJwk });
        expect(publicKey).to.deep.equal(vector.output);
      });
    }
  });

  describe('convertPrivateKeyToX25519()', () => {
    for (const vector of ed25519ConvertPrivateKeyToX25519.vectors) {
      it(vector.description, async () => {
        const x25519PrivateKey = await Ed25519.convertPrivateKeyToX25519(
          vector.input as { privateKey: PrivateKeyJwk }
        );
        expect(x25519PrivateKey).to.deep.equal(vector.output);
      });
    }
  });

  describe('convertPublicKeyToX25519()', () => {
    it('throws an error when provided an invalid Ed25519 public key', async () => {
      const invalidEd25519PublicKeyBytes = Convert.hex('02fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f').toUint8Array();

      const invalidEd25519PublicKey: PublicKeyJwk = {
        kty : 'OKP',
        crv : 'Ed25519',
        x   : Convert.uint8Array(invalidEd25519PublicKeyBytes).toBase64Url()
      };

      await expect(
        Ed25519.convertPublicKeyToX25519({ publicKey: invalidEd25519PublicKey })
      ).to.eventually.be.rejectedWith(Error, 'Invalid public key');
    });

    it('throws an error when provided an Ed25519 private key', async () => {
      const ed25519PrivateKey: PrivateKeyJwk = {
        kty : 'OKP',
        crv : 'Ed25519',
        d   : 'dwdtCnMYpX08FsFyUbJmRd9ML4frwJkqsXf7pR25LCo',
        x   : '0KTOwPi1C6HpNuxWFUVKqX37J4ZPXxdgivLLsQVI8bM'
      };

      await expect(
        Ed25519.convertPublicKeyToX25519({ publicKey: ed25519PrivateKey })
      ).to.eventually.be.rejectedWith(Error, 'provided key is not a valid OKP public key');
    });

    for (const vector of ed25519ConvertPublicKeyToX25519.vectors) {
      it(vector.description, async () => {
        const x25519PrivateKey = await Ed25519.convertPublicKeyToX25519(
          vector.input as { publicKey: PublicKeyJwk }
        );
        expect(x25519PrivateKey).to.deep.equal(vector.output);
      });
    }
  });

  describe('generateKey()', () => {
    it('returns a private key in JWK format', async () => {
      const privateKey = await Ed25519.generateKey();

      expect(privateKey).to.have.property('crv', 'Ed25519');
      expect(privateKey).to.have.property('d');
      expect(privateKey).to.have.property('kid');
      expect(privateKey).to.have.property('kty', 'OKP');
      expect(privateKey).to.have.property('x');
    });

    it('returns a 32-byte private key', async () => {
      const privateKey = await Ed25519.generateKey() as JwkParamsOkpPrivate;

      const privateKeyBytes = Convert.base64Url(privateKey.d).toUint8Array();
      expect(privateKeyBytes.byteLength).to.equal(32);
    });
  });

  describe('privateKeyToBytes()', () => {
    it('returns a private key as a byte array', async () => {
      const privateKey: PrivateKeyJwk = {
        crv : 'Ed25519',
        d   : 'TM0Imyj_ltqdtsNG7BFOD1uKMZ81q6Yk2oz27U-4pvs',
        kty : 'OKP',
        x   : 'PUAXw-hDiVqStwqnTRt-vJyYLM8uxJaMwM1V8Sr0Zgw',
        kid : 'FtIu-VbGrfe_KB6CH7GNwODB72MNxj_ml11dEvO-7kk'
      };
      const privateKeyBytes = await Ed25519.privateKeyToBytes({ privateKey });

      expect(privateKeyBytes).to.be.an.instanceOf(Uint8Array);
      const expectedOutput = Convert.hex('4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb').toUint8Array();
      expect(privateKeyBytes).to.deep.equal(expectedOutput);
    });

    it('throws an error when provided an Ed25519 public key', async () => {
      const publicKey: PublicKeyJwk = {
        crv : 'Ed25519',
        kty : 'OKP',
        x   : 'PUAXw-hDiVqStwqnTRt-vJyYLM8uxJaMwM1V8Sr0Zgw',
      };

      await expect(
        // @ts-expect-error because a public key is being passed to a method that expects a private key.
        Ed25519.privateKeyToBytes({ privateKey: publicKey })
      ).to.eventually.be.rejectedWith(Error, 'provided key is not a valid OKP private key');
    });

    for (const vector of ed25519PrivateKeyToBytes.vectors) {
      it(vector.description, async () => {
        const privateKeyBytes = await Ed25519.privateKeyToBytes({
          privateKey: vector.input.privateKey as PrivateKeyJwk
        });
        expect(privateKeyBytes).to.deep.equal(Convert.hex(vector.output).toUint8Array());
      });
    }
  });

  describe('publicKeyToBytes()', () => {
    it('returns a public key in JWK format', async () => {
      const publicKey: PublicKeyJwk = {
        kty : 'OKP',
        crv : 'Ed25519',
        x   : 'PUAXw-hDiVqStwqnTRt-vJyYLM8uxJaMwM1V8Sr0Zgw',
        kid : 'FtIu-VbGrfe_KB6CH7GNwODB72MNxj_ml11dEvO-7kk'
      };

      const publicKeyBytes = await Ed25519.publicKeyToBytes({ publicKey });

      expect(publicKeyBytes).to.be.an.instanceOf(Uint8Array);
      const expectedOutput = Convert.hex('3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c').toUint8Array();
      expect(publicKeyBytes).to.deep.equal(expectedOutput);
    });

    it('throws an error when provided an Ed25519 private key', async () => {
      const privateKey: PrivateKeyJwk = {
        crv : 'Ed25519',
        d   : 'TM0Imyj_ltqdtsNG7BFOD1uKMZ81q6Yk2oz27U-4pvs',
        kty : 'OKP',
        x   : 'PUAXw-hDiVqStwqnTRt-vJyYLM8uxJaMwM1V8Sr0Zgw',
        kid : 'FtIu-VbGrfe_KB6CH7GNwODB72MNxj_ml11dEvO-7kk'
      };

      await expect(
        Ed25519.publicKeyToBytes({ publicKey: privateKey })
      ).to.eventually.be.rejectedWith(Error, 'provided key is not a valid OKP public key');
    });

    for (const vector of ed25519PublicKeyToBytes.vectors) {
      it(vector.description, async () => {
        const publicKeyBytes = await Ed25519.publicKeyToBytes({
          publicKey: vector.input.publicKey as PublicKeyJwk
        });
        expect(publicKeyBytes).to.deep.equal(Convert.hex(vector.output).toUint8Array());
      });
    }
  });

  describe('sign()', () => {
    it('returns a 64-byte signature of type Uint8Array', async () => {
      const data = new Uint8Array([51, 52, 53]);
      const signature = await Ed25519.sign({ key: privateKey, data });
      expect(signature).to.be.instanceOf(Uint8Array);
      expect(signature.byteLength).to.equal(64);
    });

    it('accepts input data as Uint8Array', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      let signature: Uint8Array;

      signature = await Ed25519.sign({ key: privateKey, data: data });
      expect(signature).to.be.instanceOf(Uint8Array);
    });

    for (const vector of ed25519Sign.vectors) {
      it(vector.description, async () => {
        const signature = await Ed25519.sign({
          data : Convert.hex(vector.input.data).toUint8Array(),
          key  : vector.input.key as PrivateKeyJwk
        });

        const signatureHex = Convert.uint8Array(signature).toHex();
        expect(signatureHex).to.deep.equal(vector.output);
      });
    }
  });

  describe('validatePublicKey()', () => {
    it('returns true for valid public keys', async () => {
      const key = Convert.hex('a12c2beb77265f2aac953b5009349d94155a03ada416aad451319480e983ca4c').toUint8Array();
      // @ts-expect-error because validatePublicKey() is a private method.
      const isValid = await Ed25519.validatePublicKey({ key });
      expect(isValid).to.be.true;
    });

    it('returns false for invalid public keys', async () => {
      const key = Convert.hex('02fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f').toUint8Array();
      // @ts-expect-error because validatePublicKey() is a private method.
      const isValid = await Ed25519.validatePublicKey({ key });
      expect(isValid).to.be.false;
    });

    it('returns false if a private key is given', async () => {
      const key = Convert.hex('0a23a20072891237aa0864b5765139514908787878cd77135a0059881d313f00').toUint8Array();
      // @ts-expect-error because validatePublicKey() is a private method.
      const isValid = await Ed25519.validatePublicKey({ key });
      expect(isValid).to.be.false;
    });
  });

  describe('verify()', () => {
    it('returns a boolean result', async () => {
      const data = new Uint8Array([51, 52, 53]);
      const signature = await Ed25519.sign({ key: privateKey, data });

      const isValid = await Ed25519.verify({ key: publicKey, signature, data });
      expect(isValid).to.exist;
      expect(isValid).to.be.a('boolean');
    });

    it('accepts input data as Uint8Array', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const signature = await Ed25519.sign({ key: privateKey, data });

      const isValid = await Ed25519.verify({ key: publicKey, signature, data });
      expect(isValid).to.be.true;
    });

    it('returns false if the signed data was mutated', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      let isValid: boolean;

      // Generate signature using the private key.
      const signature = await Ed25519.sign({ key: privateKey, data });

      // Verification should return true with the data used to generate the signature.
      isValid = await Ed25519.verify({ key: publicKey, signature, data });
      expect(isValid).to.be.true;

      // Make a copy and flip the least significant bit (the rightmost bit) in the first byte of the array.
      const mutatedData = new Uint8Array(data);
      mutatedData[0] ^= 1 << 0;

      // Verification should return false if the given data does not match the data used to generate the signature.
      isValid = await Ed25519.verify({ key: publicKey, signature, data: mutatedData });
      expect(isValid).to.be.false;
    });

    it('returns false if the signature was mutated', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      let isValid: boolean;

      // Generate a new private key and get its public key.
      privateKey = await Ed25519.generateKey();
      publicKey = await Ed25519.computePublicKey({ privateKey });

      // Generate signature using the private key.
      const signature = await Ed25519.sign({ key: privateKey, data });

      // Make a copy and flip the least significant bit (the rightmost bit) in the first byte of the array.
      const mutatedSignature = new Uint8Array(signature);
      mutatedSignature[0] ^= 1 << 0;

      // Verification should return false if the signature was modified.
      isValid = await Ed25519.verify({ key: publicKey, signature: signature, data: mutatedSignature });
      expect(isValid).to.be.false;
    });

    it('returns false with a signature generated using a different private key', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const privateKeyA = await Ed25519.generateKey();
      const publicKeyA = await Ed25519.computePublicKey({ privateKey: privateKeyA });
      const privateKeyB = await Ed25519.generateKey();
      let isValid: boolean;

      // Generate a signature using private key B.
      const signatureB = await Ed25519.sign({ key: privateKeyB, data });

      // Verification should return false with the public key from private key A.
      isValid = await Ed25519.verify({ key: publicKeyA, signature: signatureB, data });
      expect(isValid).to.be.false;
    });

    for (const vector of ed25519Verify.vectors) {
      it(vector.description, async () => {
        const isValid = await Ed25519.verify({
          data      : Convert.hex(vector.input.data).toUint8Array(),
          key       : vector.input.key as PublicKeyJwk,
          signature : Convert.hex(vector.input.signature).toUint8Array()
        });
        expect(isValid).to.equal(vector.output);
      });
    }
  });
});