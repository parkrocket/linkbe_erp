import React, { useEffect, useState } from "react";
import { Routes } from "./pages/Routes";
import Header from "./pages/Header";

function App() {
    return (
        <React.Fragment>
            <Header />
            <Routes />
        </React.Fragment>
    );
}

export default App;
