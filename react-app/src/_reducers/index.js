import { LOGIN_USER, REGISTER_USER, AUTH_USER, LOGOUT_USER, UPDATE_USER, ADMIN_MENU, CONFIG_SET } from '../_actions/types';
import { combineReducers } from 'redux';

const rootReducer = combineReducers({
    user,
});

function user(state = {}, action) {
    switch (action.type) {
        case LOGIN_USER:
            return { ...state, loginSuccess: action.payload };

        default:
            return state;
    }
}

export default rootReducer;
