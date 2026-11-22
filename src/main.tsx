import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const root=createRoot(document.getElementById('root')!);
if(import.meta.env.DEV && new URLSearchParams(location.search).has('model-review')) {
  void import('./dev/ModelReview').then(({default:ModelReview})=>root.render(<ModelReview/>));
} else {
  root.render(<App />);
}
