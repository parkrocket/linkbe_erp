import React,{useEffect, useState} from 'react'
import VacaTable from '../component/VacaTable';
import axios from 'axios';
import SERVER_URL from '../Config';
import { useSelector } from 'react-redux';


function Vaca() {

    const [recodeList, setRecodeList] = useState([]);

    const user = useSelector((state) => state.user);
    

    
    useEffect(() => {
        
        recodeAxiosLIst(setRecodeList, user.userData.user.user_id);
    }, [user.userData.user.user_id]);

    
    const recodeAxiosLIst = (setRecodeList, user) => {
        const dataTosubmit = { user_id : user };

        axios.post(`${SERVER_URL}/api/vacation/list`, dataTosubmit).then((response) => {

            //console.log(response.data.vacationList);
            setRecodeList(response.data.vacationList);
        });
    };

    
  return (
    <div>
            <main>
                <div>
                    <div>
                        
                            <div>
                                <VacaTable
                                   list= {recodeList}
                                ></VacaTable>
                            </div>
                    
                    </div>
                </div>
            </main>
        </div>
  )
}

export default Vaca