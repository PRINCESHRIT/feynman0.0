import { Toolbar } from './Toolbar';
import { RunTreePanel } from './RunTreePanel';
import { FieldCanvas } from './FieldCanvas';
import { Palette } from './Palette';
import { PropertyPanel } from './PropertyPanel';
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
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
