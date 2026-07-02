import { ofetch } from 'ofetch';
import { CookieJar } from 'tough-cookie';

import crypto from 'node:crypto';
import qs from 'node:querystring';
import { setTimeout as sleep } from 'node:timers/promises';

import {
  buildSocksProxyConnector,
} from '@jsr/undicijs__proxy';
import { Agent } from 'undici';

/**
 * @typedef {import('./types.js').RuntimeError} RuntimeError
 * @typedef {import('./types.js').EsetLicenseInfo} EsetLicenseInfo
 */

/**
 * @typedef {import('neverthrow').Result<T, E>} Result
 * @template T
 * @template E
 */

/**
 * @param {string | undefined} socksProxyUrl Socks5 proxy Url
 */
export const createHttpActivator = (socksProxyUrl) => {
  const cookies = new CookieJar();
  const dispatcher = socksProxyUrl
    ? new Agent({
      connect: buildSocksProxyConnector(socksProxyUrl),
    })
    : undefined;

  const client = ofetch.create({
    onRequest(params) {
      const { options, request } = params;
      if (
        request === 'https://login.eset.com/connect/token' ||
        request === 'https://home.eset.com/api/License/ActivateTrialLicense' ||
        request === 'https://home.eset.com/api/Member/CreateAccountOwnerMember'
      ) return;

      options.headers = {
        ...options.headers,
        Cookie: cookies.getCookieStringSync(request),
      };
    },
    onResponse(params) {
      const { response } = params;
      const setCookie = response.headers.getSetCookie();
      for (const cookieString of setCookie) {
        cookies.setCookieSync(cookieString, response.url);
      }
    },

    ...(dispatcher ? { dispatcher } : {}),
  });

  // checkEmail was deprecated because ESET blocks the ValidateEmail endpoint now.

  /**
   * Create a new ESET account
   * @param {string} email
   * @param {string} password
   * @returns {Promise<void>}
   */
  const createAccount = async (email, password) => {
    try {
      const response = await client('https://login.eset.com/api/Account/Create', {
        method: 'POST',
        body: {
          'wantReceiveNews': false,
          'password': password,
          'email': email,
          'selectedCountry': '230',
          'agreeWithTerms': true,
          'taskId': '',
          'returnUrl': '',
          'browserFingerprint': 'bd6ee7dc8433557bf22565d5c253e318' // how to generate (?)
        },
      });

      if (response.result !== 0) {
        throw new Error('Email already registered or invalid');
      }
    } catch (error) {
      if (error.response?.status === 412 || error.response?.status === 400 || error.message === 'Email already registered or invalid') {
        throw new Error('Email already registered or invalid', { cause: error });
      }
      throw new Error('Failed to create account', { cause: error });
    }
  };

  /**
   * Authorize account and return OAuth response params
   * @param {string} challenge
   * @param {string | undefined} idToken
   * @returns {Promise<Record<string, string>>}
   */
  const authorizeAccount = async (challenge, idToken) => {
    try {
      const response = await client.raw('https://login.eset.com/connect/authorize', {
        method: 'GET',
        params: {
          client_id: 'myeset',
          redirect_uri: 'https://home.eset.com/callback',
          response_type: 'code',
          scope: 'openid mecac myesetapi',
          state: '9d7c60de575a40909e6addb9fc9deb55',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          prompt: 'none',
          response_mode: 'query',
          ...(idToken ? { id_token_hint: idToken } : {}),
        },
        redirect: 'manual',
      });

      if (response.status !== 302) {
        throw new Error('Unexpected response status during authorization');
      }

      const location = response.headers.get('location');
      if (!location || !location.includes('code=')) {
        throw new Error('Authorization code not found in redirect URL');
      }

      const oauthResponse = Object.fromEntries(new URL(location).searchParams.entries());
      return oauthResponse;
    } catch (error) {
      throw new Error('Failed to authorize account', { cause: error });
    }
  };

  /**
   * Exchange auth code for access/id tokens
   * @param {string} code
   * @param {string} verifier
   * @returns {Promise<[accessToken: string, idToken: string]>}
   */
  const exchangeCodeForToken = async (code, verifier) => {
    try {
      const response = await client('https://login.eset.com/connect/token', {
        method: 'POST',
        body: qs.encode({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: 'https://home.eset.com/callback',
          client_id: 'myeset',
          code_verifier: verifier,
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://home.eset.com',
          Referer: 'https://home.eset.com/',
        },
      });

      if (!response.access_token) {
        throw new Error('Access token not found in response');
      }

      return [response.access_token, response.id_token];
    } catch (error) {
      throw new Error('Failed to exchange code for token', { cause: error });
    }
  };

  /**
   * Check if email is confirmed for the account
   * @param {string} accessToken
   * @returns {Promise<boolean>}
   */
  const checkEmailConfirmed = async (accessToken) => {
    try {
      const response = await client('https://home.eset.com/api/Account/CheckAuthorizationIssue', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: 'text',
      });

      return response !== 'UnConfirmedEmail';
    } catch (error) {
      throw new Error('Failed to check email confirmation status', { cause: error });
    }
  };

  /**
   * Activate account using confirmation token
   * @param {string} token
   * @returns {Promise<void>}
   */
  const activateAccount = async (token) => {
    try {
      const response = await client.raw('https://login.eset.com/link/confirmregistration', {
        method: 'GET',
        params: { token },
        redirect: 'manual',
      });

      if (response.status !== 302) {
        throw new Error('Unexpected response status during account activation');
      }
    } catch (error) {
      throw new Error('Failed to activate account', { cause: error });
    }
  };

  /**
   * Activate trial license for the account
   * @param {string} accessToken
   * @returns {Promise<EsetLicenseInfo[]>}
   */
  const activateTrialLicense = async (accessToken) => {
    try {
      const response = await client('https://home.eset.com/api/License/ActivateTrialLicense', {
        method: 'POST',
        body: {
          productCode: '148',
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.length === 0) {
        throw new Error('No licenses were activated');
      }

      return response;
    } catch (error) {
      throw new Error('Failed to activate trial license', { cause: error });
    }
  };

  /**
   * Create account owner member profile
   * @param {string} accessToken
   * @param {string} name
   * @param {string} email
   * @returns {Promise<void>}
   */
  const createAccountOwnerMember = async (accessToken, name, email) => {
    try {
      const response = await client('https://home.eset.com/api/Member/CreateAccountOwnerMember', {
        method: 'POST',
        body: { name, email },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response?.homeProfile.name !== name) {
        throw new Error('Account owner member creation failed');
      }
    } catch (error) {
      throw new Error('Failed to create account owner member', { cause: error });
    }
  };

  /**
   * Generate access token via OAuth flow
   * @param {string | undefined} idToken
   * @returns {Promise<[accessToken: string, idToken: string]>}
   */
  const generateAccessToken = async (idToken) => {
    const challenge = generateChallenge();
    const oauthResponse = await authorizeAccount(challenge.challenge, idToken);
    const accessToken = await exchangeCodeForToken(oauthResponse.code, challenge.verifier);
    return accessToken;
  };

  /**
   * Extract token from activation link
   * @param {string} activationLink
   * @returns {string | null}
   */
  const extractToken = (activationLink) => {
    const url = new URL(activationLink);
    return url.searchParams.get('token');
  };

  /**
   * Generate PKCE verifier/challenge pair
   * @returns {{verifier: string, challenge: string}}
   */
  const generateChallenge = () => {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256')
      .update(verifier)
      .digest('base64url');
    return { verifier, challenge };
  };

  return {
    createAccount,
    checkEmailConfirmed,
    activateAccount,
    activateTrialLicense,
    createAccountOwnerMember,
    generateAccessToken,
  };
};

/** 
 * This file is responsible for activating ESET trial licenses.
 */
