import { LOGIN_USER, REGISTER_USER, AUTH_USER, LOGOUT_USER, GTW, GTW_STATUS } from '../_actions/types';
import { combineReducers } from 'redux';

const rootReducer = combineReducers({
    user,
    gtw,
});

function user(state = {}, action) {
    switch (action.type) {
        case LOGIN_USER:
            return { ...state, userData: action.payload, loginError: null, isAuthenticated: true };
        case REGISTER_USER:
            return { ...state, userData: action.payload, loginError: null, isAuthenticated: true };
        case AUTH_USER:
            return { ...state, userData: action.payload, loginError: null, isAuthenticated: action.payload.isAuth };
        case LOGOUT_USER:
            return { ...state, loginError: null, isAuthenticated: false };
        default:
            return state;
    }
}

function gtw(state = {}, action) {
    switch (action.type) {
        case GTW:
            return { ...state, gtwData: action.payload, isGtwStatus: action.payload.gtwSuccess };
        case GTW_STATUS:
            return { ...state, gtwData: action.payload, isGtwStatus: action.payload.gtwSuccess };
        default:
            return state;
    }
}

export default rootReducer;
