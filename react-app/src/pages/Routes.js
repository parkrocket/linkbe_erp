import React from 'react';
import { Route, Routes as ReactRouterRoutes } from 'react-router-dom';

import Main from './Main';
import Login from './Login';

export const Routes = () => {
    return (
        <ReactRouterRoutes>
            <Route path="/" element={<Main />} />
            <Route path="/login" element={<Login />} />
        </ReactRouterRoutes>
    );
};
