import React from 'react';
import { Route, Routes as ReactRouterRoutes } from 'react-router-dom';

import Main from './Main';
import Login from './Login';
import Register from './Register';
import Auth from '../hoc/Auth';
import Gtw from './Gtw';
import Vaca from './Vaca';
import Geo from './Geo';

export const Routes = () => {
    return (
        <ReactRouterRoutes>
            <Route path="/" element={Auth(Main, null)} />
            <Route path="/login" element={Auth(Login, false)} />
            <Route path="/register" element={Auth(Register, false)} />
            <Route path="/gtw" element={Auth(Gtw, null)} />
            <Route path="/vaca" element={Auth(Vaca, true)} />
            <Route path="/geo" element={Auth(Geo, null)} />
        </ReactRouterRoutes>
    );
};
