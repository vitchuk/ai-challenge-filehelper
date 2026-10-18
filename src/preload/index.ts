import { contextBridge, ipcRenderer } from 'electron'
import type { FileHelperApi } from '@shared/api'
import type { AgentEvent, ProviderId } from '@shared/types'

const api: FileHelperApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveKey: (provider: ProviderId, key: string) => ipcRenderer.invoke('settings:saveKey', provider, key),
  testKey: (provider: ProviderId, key: string) => ipcRenderer.invoke('settings:testKey', provider, key),
  setBaseURL: (provider: ProviderId, url: string) =>
    ipcRenderer.invoke('settings:setBaseURL', provider, url),
  setDefaults: (provider: ProviderId, model: string) =>
    ipcRenderer.invoke('settings:setDefaults', provider, model),

  pickWorkspace: () => ipcRenderer.invoke('workspace:pick'),
  setWorkspace: (sessionId: string, dir: string | null) =>
    ipcRenderer.invoke('workspace:set', sessionId, dir),

  listSessions: () => ipcRenderer.invoke('sessions:list'),
  createSession: (provider: ProviderId, model: string) =>
    ipcRenderer.invoke('sessions:create', provider, model),
  getSession: (id: string) => ipcRenderer.invoke('sessions:get', id),
  setSessionModel: (sessionId: string, provider: ProviderId, model: string) =>
    ipcRenderer.invoke('sessions:setModel', sessionId, provider, model),
  deleteSession: (id: string) => ipcRenderer.invoke('sessions:delete', id),
  clearSessions: () => ipcRenderer.invoke('sessions:clearAll'),

  sendMessage: (sessionId: string, text: string) =>
    ipcRenderer.invoke('agent:send', sessionId, text),
  abort: (sessionId: string) => ipcRenderer.invoke('agent:abort', sessionId),
  respondApproval: (requestId: string, approved: boolean, applyAll: boolean) =>
    ipcRenderer.invoke('agent:approval', requestId, approved, applyAll),

  revertChange: (sessionId: string, changeId: string) =>
    ipcRenderer.invoke('changes:revert', sessionId, changeId),
  applyChange: (sessionId: string, changeId: string) =>
    ipcRenderer.invoke('changes:apply', sessionId, changeId),

  readDir: (sessionId: string, relPath: string) =>
    ipcRenderer.invoke('fs:readDir', sessionId, relPath),

  onEvent: (cb: (event: AgentEvent) => void) => {
    const listener = (_e: unknown, event: AgentEvent): void => cb(event)
    ipcRenderer.on('agent:event', listener)
    return () => ipcRenderer.removeListener('agent:event', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
