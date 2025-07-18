import type { VNode, JSX } from 'preact';
import { filterAccessiblePorts, getAccessibleUrls, type Port } from '../utils/portUtils';

interface PortInfo {
  ports: Port[];
  portCount: number;
}

interface PortsDialogProps {
  isOpen: boolean;
  portInfo: PortInfo;
  onClose: () => void;
  onRefresh: () => void;
}

export function PortsDialog({
  isOpen,
  portInfo,
  onClose,
  onRefresh,
}: PortsDialogProps): VNode | null {
  const handlePortClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Get filtered ports using centralized logic
  const filteredPorts = filterAccessiblePorts(portInfo.ports);
  const filteredPortCount = filteredPorts.length;

  const getPortIcon = (port: Port) => {
    const protocol = port.protocol?.toLowerCase();
    if (protocol === 'https' || protocol === 'http') {
      return 'codicon-globe';
    } else if (protocol === 'ssh') {
      return 'codicon-terminal';
    } else {
      return 'codicon-plug';
    }
  };

  const getPortTypeLabel = (port: Port) => {
    const isUserPort = port.labels?.includes('UserForwardedPort');
    const isManagementPort = port.labels?.includes('InternalPort');

    if (isUserPort) return 'User';
    if (isManagementPort) return 'Management';
    return 'Application';
  };

  const getPortTypeBadge = (port: Port) => {
    const type = getPortTypeLabel(port);
    const badgeClass =
      type === 'User' ? 'badge-primary' : type === 'Management' ? 'badge-warning' : 'badge-success';
    return `badge ${badgeClass} badge-sm`;
  };

  if (!isOpen) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Preact JSX elements are properly typed but ESLint can't infer this
  return (
    <div className="modal modal-open" onClick={onClose}>
      <div
        className="modal-box w-11/12 max-w-4xl bg-base-100 border border-neutral-focus"
        onClick={(e: JSX.TargetedMouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header bg-base-200 p-4 rounded-t-lg -mx-6 -mt-6 mb-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <i className="codicon codicon-radio-tower text-accent text-lg"></i>
            <h3 className="font-bold text-lg text-white">Port Forwarding</h3>
            <div className="badge badge-outline text-base-content/80">
              {filteredPortCount} {filteredPortCount === 1 ? 'port' : 'ports'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="btn btn-sm btn-ghost"
              title="Refresh ports"
            >
              <i className="codicon codicon-refresh"></i>
            </button>
            <button
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-96 overflow-y-auto">
          {filteredPortCount === 0 ? (
            <div className="text-center py-8">
              <i className="codicon codicon-radio-tower text-4xl text-disabled mb-4 block"></i>
              <h4 className="text-lg font-medium text-secondary-content mb-2">No ports forwarded</h4>
              <p className="text-tertiary text-sm">
                Start a service in your codespace to see forwarded ports here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPorts.map((port) => (
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Preact JSX elements in map are properly typed
                <div
                  key={port.portNumber}
                  className="border border-info-border rounded-lg p-4 bg-info hover:bg-base-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <i className={`codicon ${getPortIcon(port)} text-accent text-lg`}></i>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-secondary-content font-medium">
                            Port {port.portNumber}
                          </span>
                          <span className={getPortTypeBadge(port)}>{getPortTypeLabel(port)}</span>
                          {port.protocol && (
                            <span className="badge badge-outline badge-sm text-tertiary">
                              {port.protocol.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {getAccessibleUrls(port).map((uri, index) => (
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Preact JSX elements in map are properly typed
                        <button
                          key={index}
                          onClick={() => handlePortClick(uri)}
                          className="btn btn-sm btn-primary text-white flex items-center gap-2"
                          title={`Open ${uri} in new window`}
                        >
                          <span className="text-sm">Open in Browser</span>
                          <i className="codicon codicon-link-external text-sm"></i>
                        </button>
                      ))}
                      {getAccessibleUrls(port).length === 0 && (
                        <div className="text-xs text-disabled italic">No standard port URL</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-action bg-base-200 p-4 rounded-b-lg -mx-6 -mb-6 mt-4 flex justify-between items-center">
          <div className="text-sm text-base-content/60">
            <i className="codicon codicon-info mr-2"></i>
            Click URLs to open applications in new windows
          </div>
          <button
            onClick={onClose}
            className="btn btn-primary border-none"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
