import chai, { expect } from 'chai';
import { Convert } from '@web5/common';
import chaiAsPromised from 'chai-as-promised';

import type { PrivateKeyJwk, PublicKeyJwk } from '../../src/jose.js';

import { XChaCha20Poly1305 } from '../../src/crypto-primitives/xchacha20-poly1305.js';

chai.use(chaiAsPromised);

// NOTE: @noble/secp256k1 requires globalThis.crypto polyfill for node.js <=18: https://github.com/paulmillr/noble-secp256k1/blob/main/README.md#usage
// Remove when we move off of node.js v18 to v20, earliest possible time would be Oct 2023: https://github.com/nodejs/release#release-schedule
import { webcrypto } from 'node:crypto';
// @ts-ignore
if (!globalThis.crypto) globalThis.crypto = webcrypto;

describe('XChaCha20Poly1305', () => {
  describe('bytesToPrivateKey()', () => {
    it('returns a private key in JWK format', async () => {
      const privateKeyBytes = Convert.hex('ffbd52af5980bd3870cdc3f3634980ae9d15b33440f63f79799eb8ca2329117f').toUint8Array();
      const privateKey = await XChaCha20Poly1305.bytesToPrivateKey({ privateKeyBytes });

      expect(privateKey).to.have.property('k');
      expect(privateKey).to.have.property('kid');
      expect(privateKey).to.have.property('kty', 'oct');
    });

    it('returns the expected JWK given byte array input', async () => {
      const privateKeyBytes = Convert.hex('2fbd52af5980bd3870cdc3f3634980ae9d15b33440f63f79799eb8ca2329117f').toUint8Array();

      const privateKey = await XChaCha20Poly1305.bytesToPrivateKey({ privateKeyBytes });

      const expectedOutput: PrivateKeyJwk = {
        k   : 'L71Sr1mAvThwzcPzY0mArp0VszRA9j95eZ64yiMpEX8',
        kty : 'oct',
        kid : '6oEQ2tFk2QI4_Lz8uxQpT4_Qce6f9ceS3ZD76nqd_qg'
      };
      expect(privateKey).to.deep.equal(expectedOutput);
    });
  });

  describe('decrypt()', () => {
    it('returns Uint8Array plaintext with length matching input', async () => {
      const plaintext = await XChaCha20Poly1305.decrypt({
        data  : Convert.hex('789e9689e5208d7fd9e1').toUint8Array(),
        key   : await XChaCha20Poly1305.bytesToPrivateKey({ privateKeyBytes: new Uint8Array(32) }),
        nonce : new Uint8Array(24),
        tag   : Convert.hex('09701fb9f36ab77a0f136ca539229a34').toUint8Array()
      });
      expect(plaintext).to.be.an('Uint8Array');
      expect(plaintext.byteLength).to.equal(10);
    });

    it('passes test vectors', async () => {
      const privateKeyBytes = Convert.hex('79c99798ac67300bbb2704c95c341e3245f3dcb21761b98e52ff45b24f304fc4').toUint8Array();
      const privateKey = await XChaCha20Poly1305.bytesToPrivateKey({ privateKeyBytes });

      const input = {
        data  : Convert.hex('80246ca517c0fb5860c19090a7e7a2b030dde4882520102cbc64fad937916596ca9d').toUint8Array(),
        key   : privateKey,
        nonce : Convert.hex('b33ffd3096479bcfbc9aee49417688a0a2554f8d95389419').toUint8Array(),
        tag   : Convert.hex('9e10a121d990e6a290f6b534516aa32f').toUint8Array()
      };
      const output = Convert.string(`Are You There Bob? It's Me, Alice.`).toUint8Array();

      const plaintext = await XChaCha20Poly1305.decrypt({
        data  : input.data,
        key   : input.key,
        nonce : input.nonce,
        tag   : input.tag
      });

      expect(plaintext).to.deep.equal(output);
    });

    it('throws an error if an invalid tag is given', async () => {
      await expect(
        XChaCha20Poly1305.decrypt({
          data  : new Uint8Array(10),
          key   : await XChaCha20Poly1305.bytesToPrivateKey({ privateKeyBytes: new Uint8Array(32) }),
          nonce : new Uint8Array(24),
          tag   : new Uint8Array(16)
        })
      ).to.eventually.be.rejectedWith(Error, 'invalid tag');
    });
  });

  describe('encrypt()', () => {
    it('returns Uint8Array ciphertext and tag', async () => {
      const { ciphertext, tag } = await XChaCha20Poly1305.encrypt({
        data  : new Uint8Array(10),
        key   : await XChaCha20Poly1305.bytesToPrivateKey({ privateKeyBytes: new Uint8Array(32) }),
        nonce : new Uint8Array(24)
      });
      expect(ciphertext).to.be.an('Uint8Array');
      expect(ciphertext.byteLength).to.equal(10);
      expect(tag).to.be.an('Uint8Array');
      expect(tag.byteLength).to.equal(16);
    });

    it('accepts additional authenticated data', async () => {
      const { ciphertext: ciphertextAad, tag: tagAad } = await XChaCha20Poly1305.encrypt({
        additionalData : new Uint8Array(64),
        data           : new Uint8Array(10),
        key            : await XChaCha20Poly1305.bytesToPrivateKey({ privateKeyBytes: new Uint8Array(32) }),
        nonce          : new Uint8Array(24)
      });

      const { ciphertext, tag } = await XChaCha20Poly1305.encrypt({
        data  : new Uint8Array(10),
        key   : await XChaCha20Poly1305.bytesToPrivateKey({ privateKeyBytes: new Uint8Array(32) }),
        nonce : new Uint8Array(24)
      });

      expect(ciphertextAad.byteLength).to.equal(10);
      expect(ciphertext.byteLength).to.equal(10);
      expect(ciphertextAad).to.deep.equal(ciphertext);
      expect(tagAad).to.not.deep.equal(tag);
    });

    it('passes test vectors', async () => {
      const privateKeyBytes = Convert.hex('79c99798ac67300bbb2704c95c341e3245f3dcb21761b98e52ff45b24f304fc4').toUint8Array();
      const privateKey = await XChaCha20Poly1305.bytesToPrivateKey({ privateKeyBytes });

      const input = {
        data  : Convert.string(`Are You There Bob? It's Me, Alice.`).toUint8Array(),
        key   : privateKey,
        nonce : Convert.hex('b33ffd3096479bcfbc9aee49417688a0a2554f8d95389419').toUint8Array()
      };
      const output = {
        ciphertext : Convert.hex('80246ca517c0fb5860c19090a7e7a2b030dde4882520102cbc64fad937916596ca9d').toUint8Array(),
        tag        : Convert.hex('9e10a121d990e6a290f6b534516aa32f').toUint8Array()
      };

      const { ciphertext, tag } = await XChaCha20Poly1305.encrypt({
        data  : input.data,
        key   : input.key,
        nonce : input.nonce
      });

      expect(ciphertext).to.deep.equal(output.ciphertext);
      expect(tag).to.deep.equal(output.tag);
    });
  });

  describe('generateKey()', () => {
    it('returns a private key in JWK format', async () => {
      const privateKey = await XChaCha20Poly1305.generateKey();

      expect(privateKey).to.have.property('k');
      expect(privateKey).to.have.property('kid');
      expect(privateKey).to.have.property('kty', 'oct');
    });
  });

  describe('privateKeyToBytes()', () => {
    it('returns a private key as a byte array', async () => {
      const privateKey = await XChaCha20Poly1305.generateKey();
      const privateKeyBytes = await XChaCha20Poly1305.privateKeyToBytes({ privateKey });

      expect(privateKeyBytes).to.be.an.instanceOf(Uint8Array);
    });

    it('returns the expected byte array for JWK input', async () => {
      const privateKey: PrivateKeyJwk = {
        k   : 'L71Sr1mAvThwzcPzY0mArp0VszRA9j95eZ64yiMpEX8',
        kty : 'oct',
        kid : '6oEQ2tFk2QI4_Lz8uxQpT4_Qce6f9ceS3ZD76nqd_qg'
      };
      const privateKeyBytes = await XChaCha20Poly1305.privateKeyToBytes({ privateKey });

      expect(privateKeyBytes).to.be.an.instanceOf(Uint8Array);
      const expectedOutput = Convert.hex('2fbd52af5980bd3870cdc3f3634980ae9d15b33440f63f79799eb8ca2329117f').toUint8Array();
      expect(privateKeyBytes).to.deep.equal(expectedOutput);
    });

    it('throws an error when provided an asymmetric public key', async () => {
      const publicKey: PublicKeyJwk = {
        crv : 'Ed25519',
        kty : 'OKP',
        x   : 'PUAXw-hDiVqStwqnTRt-vJyYLM8uxJaMwM1V8Sr0Zgw',
      };

      await expect(
        // @ts-expect-error because a public key is being passed to a method that expects a private key.
        XChaCha20Poly1305.privateKeyToBytes({ privateKey: publicKey })
      ).to.eventually.be.rejectedWith(Error, 'provided key is not a valid oct private key');
    });
  });
});