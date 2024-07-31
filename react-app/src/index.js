import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import promiseMiddleware from 'redux-promise';
import { thunk } from 'redux-thunk';
import rootReducer from './_reducers';
import { BrowserRouter as Router } from 'react-router-dom';

const store = configureStore({
    reducer: rootReducer,
    middleware: getDefaultMiddleware =>
        getDefaultMiddleware({ serializableCheck: false }).concat(
            promiseMiddleware,
            thunk,
        ),
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <Provider store={store}>
        <Router>
            <App />
        </Router>
    </Provider>,
);

console.log(
    '%c\n' +
        '    _______________________ \n' +
        '    ⎢                      ⎥ \n' +
        '    ⎢        hi! hye!!      ⎥ \n' +
        '    ⎢_____   ______________⎥ \n' +
        '          \\/    ,        ,,  \n' +
        '               /%c@%c\\      /%c@%c\\    \n' +
        '              /%c@@%c\\_____/%c@@@%c\\     \n' +
        '             /              \\                  \n' +
        '            /                \\                        \n' +
        '           /    •    •        \\              \n   ' +
        '         %c@@   ㅅ   @@%c     \\             \n' +
        '           \\                /           \n' +
        '             \\             /                \n' +
        '               \\         /                  \n' +
        '\n',
    'font-weight: bold;',
    'font-weight: bold; color: #ff7777',
    'font-weight: bold;',
    'font-weight: bold; color: #ff7777',
    'font-weight: bold;',
    'font-weight: bold; color: #ff7777',
    'font-weight: bold;',
    'font-weight: bold; color: #ff7777',
    'font-weight: bold;',
    'font-weight: bold; color: #ff7777',
    'font-weight: bold;',
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
