import { LOGIN_USER, REGISTER_USER, AUTH_USER, LOGOUT_USER, UPDATE_USER, ADMIN_MENU, CONFIG_SET } from '../_actions/types';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import promiseMiddleware from 'redux-promise';
import { thunk } from 'redux-thunk'; // 명명된 내보내기를 사용

const rootReducer = combineReducers({
    user,
    adminMenu,
    configSet,
});

const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(promiseMiddleware, thunk),
});

function user(state = {}, action) {
    switch (action.type) {
        case LOGIN_USER:
            return { ...state, loginSuccess: action.payload };
        case REGISTER_USER:
            return { ...state, register: action.payload };
        case AUTH_USER:
            return { ...state, auth: action.payload };
        case LOGOUT_USER:
            return { ...state, logout: action.payload };
        case UPDATE_USER:
            return { ...state, update: action.payload };
        default:
            return state;
    }
}

function adminMenu(state = {}, action) {
    switch (action.type) {
        case ADMIN_MENU:
            return { ...state, adminMenu: action.payload };
        default:
            return state;
    }
}

function configSet(state = {}, action) {
    switch (action.type) {
        case CONFIG_SET:
            return { ...state, config: action.payload };
        default:
            return state;
    }
}

export default store;
