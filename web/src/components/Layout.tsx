import { Toolbar } from './Toolbar';
import { RunTreePanel } from './RunTreePanel';
import { FieldCanvas } from './FieldCanvas';
import { Palette } from './Palette';
import { PropertyPanel } from './PropertyPanel';
import { ConflictList } from './ConflictList';
import { StatusBar } from './StatusBar';
import './Layout.css';

export function Layout() {
  return (
    <div className="layout">
      <Toolbar />
      <div className="layout-body">
        <RunTreePanel />
        <div className="layout-canvas">
          <FieldCanvas />
        </div>
        <div className="layout-right">
          <Palette />
          <PropertyPanel />
          <ConflictList />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
