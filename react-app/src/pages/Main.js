import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { refresh } from "../_actions/user_action";
import { gtw } from "../_actions/gtw_action";
import { Link, useNavigate } from "react-router-dom";
import RecordTable from "../component/RecordTable";
import MainStyle from "../css/Main.module.css";
import Button from "../component/Button";
import axios from "axios";
import SERVER_URL from "../Config";

function Main() {
    const user = useSelector((state) => state.user);

    const navigate = useNavigate();

    const dispatch = useDispatch();
    const [gtwStatus, setGtwStatus] = useState(false);
    const [recodeList, setRecodeList] = useState([]);

    useEffect(() => {
        recodeAxiosLIst(setRecodeList);
    }, []);

    const recodeAxiosLIst = (setRecodeList) => {
        axios.post(`${SERVER_URL}/api/list/lists`).then((response) => {
            setRecodeList(response.data.list);
        });
    };

    const handleClick = (message, gtw_status) => {
        const userId = user.userData.user.user_id;
        const type = gtw_status;
        const platform = "homepage";

        const dataTosubmit = { message, userId, type, platform };

        if (type === "done") {
            alert("퇴근 완료입니다. 오늘도 수고하셨습니다.");
        } else {
            dispatch(gtw(dataTosubmit)).then((response) => {
                if (response.payload.gtwSuccess === true) {
                    console.log(userId);

                    dispatch(refresh(dataTosubmit)).then((response) => {
                        if (response.payload.refreshSuccess === true) {
                            setGtwStatus(true);
                            recodeAxiosLIst(setRecodeList);
                        } else {
                            setGtwStatus(false);
                        }
                    });
                } else {
                    setGtwStatus(false);
                    alert(response.payload.error);
                }
            });
        }
    };

    return (
        <div>
            <main>
                <div className={`${MainStyle.container}`}>
                    <div className={MainStyle.wrapper}>
                        {user.isAuthenticated ? (
                            <div>
                                <RecordTable list={recodeList}></RecordTable>
                                {user.userData.user.gtw_status === 0 ? (
                                    <Button onClick={() => handleClick("출근하자!", "gtw")} className="bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 p-20  margin-c display-b">
                                        출근하기
                                    </Button>
                                ) : user.userData.user.gtw_status === 1 ? (
                                    <Button onClick={() => handleClick("퇴근하자!", "go")} className="bg-red-500 text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300 p-20  margin-c display-b">
                                        퇴근하기
                                    </Button>
                                ) : (
                                    <Button onClick={() => handleClick("퇴근완료", "done")} className="bg-green-500 text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-300 p-20  margin-c display-b">
                                        퇴근완료
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <p className="text-align-c">
                                <Link to="/login">로그인 해주세요!! 수정해봅니다.</Link>
                            </p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Main;
