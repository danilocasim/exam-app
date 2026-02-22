import './src/global.css';
import { AppRoot } from '@exam-app/shared';
import { APP_CONFIG } from './src/config/app.config';

export default function App() {
  return <AppRoot {...APP_CONFIG} />;
}
