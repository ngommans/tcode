/**
 * GitHub Codespace Connector for managing codespace connections
 */

import { request } from 'https';
import WebSocket from 'ws';
import {
  GITHUB_API,
  PortConverter,
  type Codespace,
  type TunnelProperties,
  type TerminalConnection,
  type PortInformation,
  type TunnelConnectionResult,
  type CodespaceState,
  type TcodeWebSocket,
  type CodespaceConnector,
} from 'tcode-shared';
//import { forwardSshPortOverTunnel } from '../tunnel/TunnelModule.js';
import { connectToTunnel } from '../tunnel/TunnelModule.js';
import { Ssh2Connector } from './Ssh2Connector.js';
import { logger } from '../utils/logger.js';
import {
  parseGitHubResponse,
  extractCodespaces,
  extractCodespaceState,
  extractTunnelProperties,
  isRetryableState,
  isCodespaceAvailable,
} from '../utils/typeSafeGitHub.js';
import type { CodespaceWebSocketHandler } from '../handlers/CodespaceWebSocketHandler.js';

interface RetryableError extends Error {
  retryable?: boolean;
  codespaceState?: string;
}

export class GitHubCodespaceConnector implements CodespaceConnector {
  private accessToken: string;
  private ws: WebSocket;
  private handler: CodespaceWebSocketHandler;

  constructor(accessToken: string, ws: WebSocket, handler: CodespaceWebSocketHandler) {
    this.accessToken = accessToken;
    this.ws = ws;
    this.handler = handler;
    logger.debug('GitHubCodespaceConnector initialized', {
      tokenSuffix: accessToken ? '*****' + accessToken.substring(accessToken.length - 4) : 'None',
    });
  }

  async listCodespaces(): Promise<Codespace[]> {
    const options = {
      hostname: 'api.github.com',
      path: '/user/codespaces',
      method: 'GET',
      headers: {
        Authorization: `token ${this.accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': GITHUB_API.USER_AGENT,
      },
    };

    logger.debug('Requesting codespaces list', {
      url: `https://${options.hostname}${options.path}`,
    });

    return new Promise((resolve, reject) => {
      const req = request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          logger.debug('Codespaces list response', { statusCode: res.statusCode });

          if (res.statusCode === 401) {
            reject(new Error('Bad credentials'));
            return;
          }

          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`GitHub API Error: ${res.statusCode} ${data}`));
            return;
          }

          try {
            const result = parseGitHubResponse(data);
            const codespaces = extractCodespaces(result);
            logger.debug('Codespaces list parsed', { count: codespaces.length });
            resolve(codespaces);
          } catch (error) {
            logger.error('Failed to parse codespaces response', error as Error);
            reject(error as Error);
          }
        });
      });

      req.on('error', (e) => {
        logger.error('Request error', e);
        reject(e);
      });

      req.end();
    });
  }

  async getTunnelProperties(codespaceName: string): Promise<TunnelProperties> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/user/codespaces/${codespaceName}?internal=true&refresh=true`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'User-Agent': GITHUB_API.USER_AGENT,
        },
      };

      const req = request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          logger.debug('Tunnel properties response', { statusCode: res.statusCode });

          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`GitHub API Error: ${res.statusCode} ${data}`));
            return;
          }

          try {
            const response = parseGitHubResponse(data);
            const state = extractCodespaceState(response);

            // Check codespace state before attempting connection
            if (!isCodespaceAvailable(response)) {
              if (state && isRetryableState(state)) {
                const retryableError = new Error(
                  `Codespace is ${state}. This is normal during initialization - please retry in 30-60 seconds.`
                );
                (retryableError as RetryableError).retryable = true;
                (retryableError as RetryableError).codespaceState = state;
                this.sendCodespaceState(this.ws, codespaceName, state);
                return reject(retryableError);
              } else {
                const error = new Error(
                  `Codespace is not available. Current state: ${state || 'Unknown'}. Please start the codespace first.`
                );
                if (state) {
                  this.sendCodespaceState(this.ws, codespaceName, state);
                }
                return reject(error);
              }
            }

            const tunnelProperties = extractTunnelProperties(response);
            if (tunnelProperties) {
              resolve(tunnelProperties);
            } else {
              reject(
                new Error('Tunnel properties not found in response. Codespace may not be ready.')
              );
            }
          } catch (parseError) {
            logger.error('Failed to parse tunnel properties', parseError as Error);
            reject(parseError as Error);
          }
        });
      });

      req.on('error', (e) => {
        logger.error('Tunnel properties request error', e);
        reject(e);
      });

      req.end();
    });
  }

  async connectToCodespace(
    codespaceName: string,
    onTerminalData: (data: string) => void,
    ws: TcodeWebSocket
  ): Promise<TerminalConnection> {
    try {
      logger.info('Intercepting connection request for codespace', { codespaceName });

      // If there's an existing tunnel connection, dispose of it properly
      if (ws.tunnelConnection || ws.rpcConnection) {
        logger.info('Disposing of existing tunnel and RPC connections');
        try {
          // Close RPC connection first (stops heartbeat)
          if (ws.rpcConnection) {
            await ws.rpcConnection.close();
          }
          // Close tunnel connection wrapper
          if (ws.tunnelConnection) {
            await ws.tunnelConnection.close();
          }
        } catch (disposeError) {
          logger.error('Error disposing existing connections', disposeError as Error);
        }
        ws.tunnelConnection = undefined;
        ws.rpcConnection = undefined;
        ws.portInfo = undefined;
        ws.endpointInfo = undefined;
      }

      const tunnelProperties = await this.getTunnelProperties(codespaceName);
      // const result: TunnelConnectionResult = await forwardSshPortOverTunnel(tunnelProperties, {
      //   debugMode: this.options.debugMode
      // });

      const result: TunnelConnectionResult = await connectToTunnel(
        { name: 'minimal-terminal-client', version: '1.0.0' }, // userAgent
        tunnelProperties
      );

      // Store tunnel information on the WebSocket session
      ws.tunnelConnection = result.tunnelConnection; // New wrapper for type-safe access
      ws.portInfo = result.portInfo;
      ws.endpointInfo = result.endpointInfo;
      ws.rpcConnection = result.rpcConnection; // Store RPC connection for cleanup

      logger.info('Connecting to local port', { localPort: result.localPort });

      // Send connecting state first
      this.sendCodespaceState(
        ws,
        codespaceName,
        'Starting',
        `Establishing SSH connection via tunnel`
      );

      // Get private key from RPC connection
      const privateKey = result.rpcConnection?.getCurrentPrivateKey();
      if (!privateKey) {
        const errorMsg = 'No SSH private key available from RPC connection';
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      const sshConnector = new Ssh2Connector(privateKey);
      const terminalConnection = await sshConnector.connectViaSSH(
        (data) => {
          onTerminalData(data);
        },
        (error) => {
          logger.error('SSH Terminal Error', { error });
          if (ws && ws.readyState === WebSocket.OPEN) {
            this.handler.sendError(ws, error.toString());
            this.sendCodespaceState(ws, codespaceName, 'Shutdown');
          }
        },
        result.localPort || 2222
      );

      // Send connected state after successful SSH connection
      this.sendCodespaceState(ws, codespaceName, 'Connected', `tunnel -> ${codespaceName}`);
      logger.info('Successfully connected to codespace SSH', {
        codespaceName,
        localPort: result.localPort,
      });

      // Send initial port information to client
      this.sendPortUpdate(ws, result.portInfo);

      return terminalConnection;
    } catch (error) {
      logger.error('Failed to connect to codespace', error as Error);
      this.sendCodespaceState(ws, codespaceName, 'Disconnected');
      throw error;
    }
  }

  sendCodespaceState(
    _ws: TcodeWebSocket,
    codespaceName: string,
    state: CodespaceState,
    repositoryFullName?: string
  ): void {
    if (this.handler && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.handler.sendMessage(this.ws, {
        type: 'codespace_state',
        codespace_name: codespaceName,
        state: state,
        repository_full_name: repositoryFullName,
      });
    }
  }

  sendPortUpdate(_ws: TcodeWebSocket, portInfo: PortInformation): void {
    if (this.handler && this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Use PortConverter to eliminate manual mapping
      const userPortsForwarded = portInfo.userPorts.map((port) =>
        PortConverter.tunnelToForwarded(port, true)
      );

      this.handler.sendMessage(this.ws, {
        type: 'port_update',
        portCount: portInfo.userPorts.length,
        ports: userPortsForwarded,
        timestamp: portInfo.timestamp || new Date().toISOString(),
      });
    }
  }

  async refreshPortInformation(ws: TcodeWebSocket): Promise<PortInformation> {
    if (ws.tunnelConnection) {
      try {
        // Use the tunnel connection wrapper to get port information
        const updatedPortInfo = await ws.tunnelConnection.refreshPortInformation();
        ws.portInfo = updatedPortInfo;
        this.sendPortUpdate(ws, updatedPortInfo);
        return updatedPortInfo;
      } catch (error) {
        logger.error('Failed to refresh port information', error as Error);
        return (
          (ws.portInfo as PortInformation) || { userPorts: [], managementPorts: [], allPorts: [] }
        );
      }
    }
    return { userPorts: [], managementPorts: [], allPorts: [] };
  }
}
