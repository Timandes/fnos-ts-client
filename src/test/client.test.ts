// Copyright 2025 Timandes White
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { FnosClient } from '../client.js';

describe('FnosClient - Timer Cleanup', () => {
  let client: FnosClient;

  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
    if (client) {
      try {
        client.close();
      } catch (e) {
        // Ignore
      }
    }
  });

  it('should clear login timeout timer when login succeeds', async () => {
    client = new FnosClient();

    let wsInstance: any = null;
    const wsMock = mock.method(require('ws'), 'WebSocket', function(this: any, url: string) {
      wsInstance = this;
      this.readyState = 0; // CONNECTING
      this.url = url;
      this.send = mock.fn();
      this.close = mock.fn(() => {
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose();
      });
    });

    // Simulate connection process
    const connectPromise = client.connect('127.0.0.1:5666', 3000);

    // Simulate WebSocket open
    await new Promise(resolve => setTimeout(resolve, 10));
    if (wsInstance) {
      wsInstance.readyState = 1; // OPEN
      if (wsInstance.onopen) wsInstance.onopen();

      // Simulate getting RSA public key
      await new Promise(resolve => setTimeout(resolve, 10));
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage(Buffer.from(JSON.stringify({
          pub: 'public-key',
          si: 'session-id',
          reqid: 'reqid-1',
        })));
      }

      // Simulate getting host name
      await new Promise(resolve => setTimeout(resolve, 10));
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage(Buffer.from(JSON.stringify({
          data: { hostName: 'test-host', trimVersion: '1.0' },
          reqid: 'reqid-2',
        })));
      }
    }

    await connectPromise;

    // Call login and simulate successful response
    const loginPromise = client.login('testuser', 'testpass', 10000);

    await new Promise(resolve => setTimeout(resolve, 10));
    const reqid = (client as any).loginReqid;
    if ((client as any).ws?.onmessage) {
      (client as any).ws.onmessage(Buffer.from(JSON.stringify({
        result: 'succ',
        token: 'test-token',
        longToken: 'test-long-token',
        secret: 'encrypted-secret',
        reqid: reqid,
      })));
    }

    await loginPromise;

    // Verify that the timeout timer was cleared
    assert.strictEqual((client as any).loginTimeoutTimer, null, 'loginTimeoutTimer should be null after successful login');
  });

  it('should clear login timeout timer when login fails', async () => {
    client = new FnosClient();

    let wsInstance: any = null;
    const wsMock = mock.method(require('ws'), 'WebSocket', function(this: any, url: string) {
      wsInstance = this;
      this.readyState = 0; // CONNECTING
      this.url = url;
      this.send = mock.fn();
      this.close = mock.fn(() => {
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose();
      });
    });

    // Simulate connection process
    const connectPromise = client.connect('127.0.0.1:5666', 3000);

    // Simulate WebSocket open
    await new Promise(resolve => setTimeout(resolve, 10));
    if (wsInstance) {
      wsInstance.readyState = 1; // OPEN
      if (wsInstance.onopen) wsInstance.onopen();

      // Simulate getting RSA public key
      await new Promise(resolve => setTimeout(resolve, 10));
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage(Buffer.from(JSON.stringify({
          pub: 'public-key',
          si: 'session-id',
          reqid: 'reqid-1',
        })));
      }

      // Simulate getting host name
      await new Promise(resolve => setTimeout(resolve, 10));
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage(Buffer.from(JSON.stringify({
          data: { hostName: 'test-host', trimVersion: '1.0' },
          reqid: 'reqid-2',
        })));
      }
    }

    await connectPromise;

    // Call login and simulate failed response
    const loginPromise = client.login('testuser', 'wrongpass', 10000);

    await new Promise(resolve => setTimeout(resolve, 10));
    const reqid = (client as any).loginReqid;
    if ((client as any).ws?.onmessage) {
      (client as any).ws.onmessage(Buffer.from(JSON.stringify({
        result: 'fail',
        msg: 'Invalid credentials',
        reqid: reqid,
      })));
    }

    try {
      await loginPromise;
      assert.fail('login should have failed');
    } catch (e) {
      // Expected failure
    }

    // Verify that the timeout timer was cleared
    assert.strictEqual((client as any).loginTimeoutTimer, null, 'loginTimeoutTimer should be null after failed login');
  });

  it('should clear request timeout timer when response is received', async () => {
    client = new FnosClient();

    let wsInstance: any = null;
    const wsMock = mock.method(require('ws'), 'WebSocket', function(this: any, url: string) {
      wsInstance = this;
      this.readyState = 0; // CONNECTING
      this.url = url;
      this.send = mock.fn();
      this.close = mock.fn(() => {
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose();
      });
    });

    // Simulate connection process
    const connectPromise = client.connect('127.0.0.1:5666', 3000);

    // Simulate WebSocket open
    await new Promise(resolve => setTimeout(resolve, 10));
    if (wsInstance) {
      wsInstance.readyState = 1; // OPEN
      if (wsInstance.onopen) wsInstance.onopen();

      // Simulate getting RSA public key
      await new Promise(resolve => setTimeout(resolve, 10));
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage(Buffer.from(JSON.stringify({
          pub: 'public-key',
          si: 'session-id',
          reqid: 'reqid-1',
        })));
      }

      // Simulate getting host name
      await new Promise(resolve => setTimeout(resolve, 10));
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage(Buffer.from(JSON.stringify({
          data: { hostName: 'test-host', trimVersion: '1.0' },
          reqid: 'reqid-2',
        })));
      }
    }

    await connectPromise;

    // Set up the required state for requestPayloadWithResponse
    (client as any).decryptedSecret = Buffer.from('test-secret').toString('base64');
    (client as any).connected = true;

    // Call requestPayloadWithResponse
    const requestPromise = client.requestPayloadWithResponse('user.info', {}, 10000);

    await new Promise(resolve => setTimeout(resolve, 10));

    // Simulate response
    const sendCalls = (client as any).ws?.send?.mock?.calls || [];
    const lastCall = sendCalls[sendCalls.length - 1];
    if (lastCall) {
      const sentData = JSON.parse(lastCall.arguments[0]);
      const reqid = sentData.reqid;

      if ((client as any).ws?.onmessage) {
        (client as any).ws.onmessage(Buffer.from(JSON.stringify({
          result: 'succ',
          reqid: reqid,
          data: { test: 'data' },
        })));
      }
    }

    const response = await requestPromise;
    assert.ok(response);

    // Verify that the timeout timer was cleared (pendingRequests should be empty)
    assert.strictEqual((client as any).pendingRequests.size, 0, 'pendingRequests should be empty after response');
  });

  it('should clear all timers when close() is called', async () => {
    client = new FnosClient();

    let wsInstance: any = null;
    const wsMock = mock.method(require('ws'), 'WebSocket', function(this: any, url: string) {
      wsInstance = this;
      this.readyState = 0; // CONNECTING
      this.url = url;
      this.send = mock.fn();
      this.close = mock.fn(() => {
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose();
      });
    });

    // Simulate connection process
    const connectPromise = client.connect('127.0.0.1:5666', 3000);

    // Simulate WebSocket open
    await new Promise(resolve => setTimeout(resolve, 10));
    if (wsInstance) {
      wsInstance.readyState = 1; // OPEN
      if (wsInstance.onopen) wsInstance.onopen();

      // Simulate getting RSA public key
      await new Promise(resolve => setTimeout(resolve, 10));
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage(Buffer.from(JSON.stringify({
          pub: 'public-key',
          si: 'session-id',
          reqid: 'reqid-1',
        })));
      }

      // Simulate getting host name
      await new Promise(resolve => setTimeout(resolve, 10));
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage(Buffer.from(JSON.stringify({
          data: { hostName: 'test-host', trimVersion: '1.0' },
          reqid: 'reqid-2',
        })));
      }
    }

    await connectPromise;

    // Start a login (which creates a timeout timer)
    const loginPromise = client.login('testuser', 'testpass', 10000);

    // Don't wait for response, just call close()
    client.close();

    // Verify all timers are cleared
    assert.strictEqual((client as any).loginTimeoutTimer, null, 'loginTimeoutTimer should be null after close()');
    assert.strictEqual((client as any).pendingRequests.size, 0, 'pendingRequests should be empty after close()');
  });
});