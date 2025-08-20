import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.scss';

console.log('main.jsx starting...');
console.log('React:', React);
console.log('ReactDOM:', ReactDOM);

const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  console.log('Root created:', root);
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  
  console.log('App rendered!');
} else {
  console.error('Root element not found!');
}
