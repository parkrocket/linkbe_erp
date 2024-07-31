import React, { useEffect, useState } from 'react';
import './css/Reset.css';
import './css/CommonClass.css';
import { Routes } from './pages/Routes';
import Header from './pages/Header';
import Footer from './pages/Footer';

function App() {
    return (
        <React.Fragment>
            <Header />
            <Routes />
            <Footer />
        </React.Fragment>
    );
}

export default App;
