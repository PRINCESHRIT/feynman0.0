import { Toolbar } from './Toolbar';
import { RunTreePanel } from './RunTreePanel';
import { FieldCanvas } from './FieldCanvas';
import { DiffView } from './DiffView';
import { Palette } from './Palette';
import { PropertyPanel } from './PropertyPanel';
import { BoundaryControls } from './BoundaryControls';
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
          <DiffView />
        </div>
        <div className="layout-right">
          <Palette />
          <PropertyPanel />
          <BoundaryControls />
          <ConflictList />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
