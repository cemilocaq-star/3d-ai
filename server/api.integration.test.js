import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

let provider;
let apiProcess;
let apiUrl;
let providerRequest;

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

async function freePort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

const builtFrontendExists = existsSync(new URL('../dist/index.html', import.meta.url));

before(async () => {
  provider = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    providerRequest = { url: request.url, headers: request.headers, body: JSON.parse(body) };
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: 'Hello from Nova test provider.' } }]
    }));
  });
  const providerPort = await listen(provider);
  const apiPort = await freePort();
  apiUrl = 'http://127.0.0.1:' + apiPort;

  apiProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(apiPort),
      NOVA_PROVIDER_API_KEY: 'integration-test-key',
      NOVA_PROVIDER_BASE_URL: 'http://127.0.0.1:' + providerPort + '/v1',
      NOVA_MODEL: 'nova-test-model'
    },
    stdio: 'ignore'
  });

  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (apiProcess.exitCode !== null) throw new Error('Nova API process exited before becoming ready.');
    try {
      const response = await fetch(apiUrl + '/api/v1/health');
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Nova API did not become ready in time.');
}, { timeout: 10_000 });

after(async () => {
  if (apiProcess && apiProcess.exitCode === null) {
    apiProcess.kill('SIGTERM');
    await Promise.race([
      once(apiProcess, 'exit'),
      new Promise(resolve => setTimeout(resolve, 2_000))
    ]);
    if (apiProcess.exitCode === null) apiProcess.kill('SIGKILL');
  }
  if (provider?.listening) {
    await new Promise((resolve, reject) => provider.close(error => error ? reject(error) : resolve()));
  }
});

test('serves the production studio shell and hashed assets from the same origin', { skip: !builtFrontendExists }, async () => {
  const response = await fetch(apiUrl + '/');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Nova 3D AI Studio/);
  const script = html.match(/src="([^"]+\.js)"/);
  assert.ok(script, 'production page should include its built JavaScript bundle');
  const asset = await fetch(new URL(script[1], apiUrl));
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type') || '', /javascript/);
});

test('Nova health endpoint reports its own API version and provider readiness without leaking secrets', async () => {
  const response = await fetch(apiUrl + '/api/v1/health');
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.name, 'Nova API');
  assert.equal(data.apiVersion, 'v1');
  assert.equal(data.configured, true);
  assert.equal(data.model, 'nova-test-model');
  assert.equal(JSON.stringify(data).includes('integration-test-key'), false);
});

test('Nova chat endpoint carries a multi-turn conversation to its configured provider', async () => {
  const response = await fetch(apiUrl + '/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Hi Nova.' },
        { role: 'assistant', content: 'Hello! What would you like to discuss?' },
        { role: 'user', content: 'Can we plan a 3D scene?' }
      ],
      mode: 'Nova Studio'
    })
  });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.reply, 'Hello from Nova test provider.');
  assert.equal(data.api, 'Nova API v1');
  assert.equal(data.model, 'nova-test-model');
  assert.equal(providerRequest.url, '/v1/chat/completions');
  assert.equal(providerRequest.body.messages.at(-1).content, 'Can we plan a 3D scene?');
  assert.equal(providerRequest.body.messages.filter(message => message.role === 'user').length, 2);
  assert.match(providerRequest.body.messages[0].content, /You are Nova/);
});

test('Nova chat rejects a conversation whose final message is not from the user', async () => {
  const response = await fetch(apiUrl + '/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'assistant', content: 'I am not the latest user.' }] })
  });
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.match(data.error, /latest chat message must be from the user/i);
});
