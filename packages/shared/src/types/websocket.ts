/**
 * @file Defines the WebSocket message types for communication between the client and server.
 * This file is the single source of truth for the communication protocol.
 *
 * By documenting the types here with TSDoc, we create a "self-describing" protocol.
 * Developers can hover over these types in their IDE to get detailed information
 * about the purpose and payload of each message.
 */

export interface BaseMessage {
  type: string;
}

// =================================================================
// #region Client to Server Messages
// =================================================================

/**
 * Sent by the client to authenticate with the server using a GitHub token.
 * This is the first message sent after the WebSocket connection is established.
 * @param token - A GitHub personal access token with `codespace` scope.
 */
export interface AuthenticateMessage extends BaseMessage {
  type: 'authenticate';
  token: string;
}

/**
 * Sent by the client to request the list of available GitHub Codespaces
 * for the authenticated user.
 */
export interface ListCodespacesMessage extends BaseMessage {
  type: 'list_codespaces';
}

/**
 * Sent by the client to initiate a connection to a specific codespace.
 * The server will handle the tunnel creation and SSH connection.
 * @param codespace_name - The unique name of the codespace to connect to.
 */
export interface ConnectCodespaceMessage extends BaseMessage {
  type: 'connect_codespace';
  codespace_name: string;
}

/**
 * Sent by the client to gracefully disconnect from the current codespace.
 * The server will tear down the SSH connection and tunnel.
 */
export interface DisconnectCodespaceMessage extends BaseMessage {
  type: 'disconnect_codespace';
}

/**
 * Sent by the client to request that a stopped codespace be started.
 * @param codespace_name - The name of the codespace to start.
 */
export interface StartCodespaceMessage extends BaseMessage {
  type: 'start_codespace';
  codespace_name: string;
}

/**
 * Sent by the client to request that a running codespace be stopped.
 * @param codespace_name - The name of the codespace to stop.
 */
export interface StopCodespaceMessage extends BaseMessage {
  type: 'stop_codespace';
  codespace_name: string;
}

/**
 * Sent by the client to send user input (e.g., keystrokes) to the
 * remote terminal session.
 * @param data - The string of characters to write to the terminal's PTY.
 */
export interface InputMessage extends BaseMessage {
  type: 'input';
  data: string;
}

/**
 * Sent by the client to inform the server that the terminal UI has been
 * resized, so the remote PTY can be adjusted accordingly.
 * @param cols - The new number of columns.
 * @param rows - The new number of rows.
 */
export interface ResizeMessage extends BaseMessage {
  type: 'resize';
  cols: number;
  rows: number;
}

/**
 * Sent by the client to execute an initial command upon connection.
 * (Currently unused, reserved for future functionality).
 * @param command - The command to execute.
 */
export interface SendInitialCommandMessage extends BaseMessage {
  type: 'send_initial_command';
  command: string;
}

/**
 * Sent by the client to request the current port information.
 * (Currently unused, as port info is pushed automatically).
 */
export interface GetPortInfoMessage extends BaseMessage {
  type: 'get_port_info';
}

/**
 * Sent by the client to manually request a refresh of the forwarded ports
 * from the codespace.
 */
export interface RefreshPortsMessage extends BaseMessage {
  type: 'refresh_ports';
}

/**
 * Sent by the client to find and connect to a codespace for a specific repository.
 * (Currently unused, reserved for future functionality).
 * @param repo_url - The URL of the GitHub repository.
 */
export interface ConnectToRepoCodespaceMessage extends BaseMessage {
  type: 'connect_to_repo_codespace';
  repo_url: string;
}

/**
 * Sent by the client to query the status of all codespaces.
 * (Currently unused, reserved for future functionality).
 */
export interface QueryCodespaceStatusMessage extends BaseMessage {
  type: 'query_codespace_status';
}

/**
 * A union type representing all possible messages that can be sent from the client to the server.
 */
export type ClientMessage =
  | AuthenticateMessage
  | ListCodespacesMessage
  | ConnectCodespaceMessage
  | DisconnectCodespaceMessage
  | StartCodespaceMessage
  | StopCodespaceMessage
  | InputMessage
  | ResizeMessage
  | SendInitialCommandMessage
  | GetPortInfoMessage
  | RefreshPortsMessage
  | ConnectToRepoCodespaceMessage
  | QueryCodespaceStatusMessage;

// =================================================================
// #endregion
// =================================================================

// =================================================================
// #region Server to Client Messages
// =================================================================

/**
 * Sent by the server to confirm the result of an authentication attempt.
 * @param success - `true` if authentication was successful, otherwise `false`.
 */
export interface AuthenticatedMessage extends BaseMessage {
  type: 'authenticated';
  success: boolean;
}

/**
 * Sent by the server to provide the client with the list of available codespaces.
 * @param data - An array of `Codespace` objects.
 */
export interface CodespacesListMessage extends BaseMessage {
  type: 'codespaces_list';
  data: Codespace[];
}

/**
 * Sent by the server to stream output from the remote terminal to the client's UI.
 * @param data - The chunk of data (stdout or stderr) from the remote PTY.
 */
export interface OutputMessage extends BaseMessage {
  type: 'output';
  data: string;
}

/**
 * Sent by the server to inform the client of a non-fatal error.
 * @param message - A human-readable error message.
 */
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  message: string;
}

/**
 * Sent by the server to update the client on the state of a codespace
 * during the connection process (e.g., 'Starting', 'Available', 'Connected').
 */
export interface CodespaceStateMessage extends BaseMessage {
  type: 'codespace_state';
  codespace_name: string;
  state: CodespaceState;
  repository_full_name?: string;
  codespace_data?: Partial<Codespace>;
}

/**
 * Sent by the server to update the client on the connection status.
 * (Currently unused, `CodespaceStateMessage` is used instead).
 */
export interface CodespaceConnectionStatusMessage extends BaseMessage {
  type: 'codespace_connection_status';
  codespace_name: string;
  state: CodespaceState;
}

/**
 * Sent by the server whenever the list of forwarded ports in the codespace changes.
 */
export interface PortUpdateMessage extends BaseMessage {
  type: 'port_update';
  portCount: number;
  ports: ForwardedPort[];
  timestamp: string;
}

/**
 * Sent by the server in response to a `get_port_info` message.
 * (Currently unused).
 */
export interface PortInfoResponseMessage extends BaseMessage {
  type: 'port_info_response';
  portInfo: WebSocketPortInformation;
}

/**
 * Sent by the server to confirm that the client has been disconnected
 * from a codespace.
 */
export interface DisconnectedFromCodespaceMessage extends BaseMessage {
  type: 'disconnected_from_codespace';
}

/**
 * A union type representing all possible messages that can be sent from the server to the client.
 */
export type ServerMessage =
  | AuthenticatedMessage
  | CodespacesListMessage
  | OutputMessage
  | ErrorMessage
  | CodespaceStateMessage
  | CodespaceConnectionStatusMessage
  | PortUpdateMessage
  | PortInfoResponseMessage
  | DisconnectedFromCodespaceMessage;

// =================================================================
// #endregion
// =================================================================

export type WebSocketMessage = ClientMessage | ServerMessage;

// =================================================================
// #region Supporting Types
// =================================================================

// Import GitHub API schema as source of truth
import type { GitHubCodespaceState, GitHubCodespace } from '../schemas/github-codespace-api.js';

/**
 * Represents the lifecycle states of a GitHub Codespace connection.
 * Extended with our internal states for connection status.
 */
export type CodespaceState = GitHubCodespaceState | 'Connected' | 'Disconnected';

/**
 * Represents a GitHub Codespace, containing its metadata and status.
 * Based on the official GitHub REST API schema.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Justified: Estensibility - mirrors (today) GitHub API schema
export interface Codespace extends GitHubCodespace {
  // All properties inherited from GitHubCodespace
  // This ensures we stay in sync with the official API
}

// Port types moved to ./port.ts for unified hierarchy
// Re-export for backwards compatibility
export type { ForwardedPort, WebSocketPortInformation } from './port.js';
import type { ForwardedPort, WebSocketPortInformation } from './port.js';

// =================================================================
// #endregion
// =================================================================
