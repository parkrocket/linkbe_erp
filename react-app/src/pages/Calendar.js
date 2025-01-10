import React, { useState } from 'react';
import FullCalendar from '@fullcalendar/react'; // FullCalendar 컴포넌트
import dayGridPlugin from '@fullcalendar/daygrid'; // DayGrid 뷰
import interactionPlugin from '@fullcalendar/interaction'; // 사용자 입력 처리
import koLocale from '@fullcalendar/core/locales/ko'; // 한국어 로케일
import axios from 'axios';
import CalendarStyle from '../css/Calendar.module.scss';
import SERVER_URL from '../Config';
import { Modal, Box, TextField, Button } from '@mui/material';

function Calendar() {
    const [events, setEvents] = useState([]); // 로컬 이벤트 상태 관리
    const [modalOpen, setModalOpen] = useState(false); // 모달 열림 상태
    const [modalType, setModalType] = useState(''); // 'add' 또는 'edit'
    const [selectedEvent, setSelectedEvent] = useState(null); // 선택된 이벤트 정보
    const [title, setTitle] = useState(''); // 입력된 일정 제목

    // Google Calendar API 데이터를 FullCalendar 형식으로 변환하는 함수
    const transformGoogleEventsToFullCalendarEvents = googleEvents => {
        return googleEvents.map(event => ({
            id: event.id,
            title: event.summary,
            start: event.start.date || event.start.dateTime,
            end: event.end.date || event.end.dateTime,
            allDay: true,
        }));
    };

    // 서버에서 이벤트를 가져오는 함수
    const fetchEvents = async (start, end) => {
        try {
            const response = await axios.get(
                `${SERVER_URL}/api/calendar/events`,
                {
                    params: {
                        timeMin: start.toISOString(),
                        timeMax: end.toISOString(),
                    },
                },
            );

            setEvents(response.data); // 서버에서 전달된 데이터를 그대로 상태로 저장
        } catch (error) {
            console.error('Error fetching events:', error);
        }
    };

    // FullCalendar의 날짜 범위가 변경될 때 호출되는 함수
    const handleDatesSet = dateInfo => {
        const { start, end } = dateInfo;
        fetchEvents(start, end);
    };

    // 모달 열기
    const openModal = (type, event = null) => {
        setModalType(type);
        setSelectedEvent(event);
        setTitle(event ? event.title : '');
        setModalOpen(true);
    };

    // 모달 닫기
    const closeModal = () => {
        setModalOpen(false);
        setTitle('');
        setSelectedEvent(null);
    };

    // 새 이벤트 추가
    const handleDateClick = info => {
        openModal('add', {
            start: info.dateStr,
            end: info.dateStr,
            allDay: true,
        });
    };

    // 이벤트 수정
    const handleEventClick = info => {
        setSelectedEvent(info.event);
        openModal('edit', info.event);
    };

    // Google Calendar에 이벤트 추가
    const addEventToGoogleCalendar = async event => {
        console.log(event);

        try {
            const response = await axios.post(`${SERVER_URL}/api/calendar/in`, {
                summary: event.title,
                start: { date: event.start },
                end: { date: event.end },
            });
            console.log('Event added:', response.data);
        } catch (error) {
            console.error('Error adding event to Google Calendar:', error);
        }
    };

    // Google Calendar에 이벤트 수정
    const updateEventInGoogleCalendar = async event => {
        try {
            const response = await axios.post(
                `${SERVER_URL}/api/calendar/update`,
                {
                    id: event.id,
                    summary: event.title,
                    start: { date: event.start },
                    end: { date: event.end },
                },
            );
        } catch (error) {
            console.error('Error updating event:', error);
        }
    };

    const deleteEventFromGoogleCalendar = async eventId => {
        try {
            const response = await axios.post(
                `${SERVER_URL}/api/calendar/delete`,
                {
                    id: eventId,
                },
            );
            console.log('Event deleted:', response.data);
        } catch (error) {
            console.error('Error deleting event:', error);
        }
    };

    // 모달에서 확인 버튼 클릭 시 실행
    const handleSave = () => {
        if (!title) {
            alert('제목을 입력해주세요.');
            return;
        }

        if (modalType === 'add') {
            const newEvent = {
                title,
                start: selectedEvent.start,
                end: selectedEvent.end,
                allDay: true,
                classNames: 'user-event',
            };
            setEvents([...events, newEvent]); // 로컬 상태 업데이트
            addEventToGoogleCalendar(newEvent); // Google Calendar에 새 이벤트 추가
        } else if (modalType === 'edit') {
            if (!selectedEvent?.id) {
                console.error('선택된 이벤트에 ID가 없습니다.');
                return;
            }

            const updatedEvent = {
                id: selectedEvent._def.publicId, // FullCalendar의 publicId가 Google Calendar ID
                title, // 새 제목
                start: formatDate(selectedEvent._instance.range.start), // 시작 시간
                end: formatDate(selectedEvent._instance.range.end), // 종료 시간
                allDay: selectedEvent.allDay, // allDay 여부
                classNames: 'user-event',
            };

            // 로컬 상태 업데이트
            const updatedEvents = events.map(event =>
                event.id === updatedEvent.id ? updatedEvent : event,
            );

            setEvents(updatedEvents);

            // 단일 이벤트만 업데이트
            updateEventInGoogleCalendar(updatedEvent);
        }

        closeModal();
    };

    const handleDelete = eventId => {
        if (!window.confirm('정말로 이 이벤트를 삭제하시겠습니까?')) {
            return;
        }

        // Google Calendar에서 삭제
        deleteEventFromGoogleCalendar(eventId);

        // 로컬 상태 업데이트
        const updatedEvents = events.filter(event => event.id !== eventId);
        setEvents(updatedEvents);

        closeModal();
    };

    const formatDate = date => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0'); // 월은 0부터 시작하므로 +1
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    return (
        <div className={CalendarStyle.calendarContainer}>
            <h1 className={CalendarStyle.calendarTitle}>링크비 일정 관리</h1>
            <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                locale={koLocale} // 한국어 로케일 적용
                events={events} // 서버에서 가져온 이벤트 데이터
                aspectRatio={2}
                firstDay={1}
                eventClassNames={info => {
                    // 서버에서 전달된 className을 SCSS 모듈로 매핑
                    const { classNames } = info.event;

                    return classNames[0] === 'user-event'
                        ? CalendarStyle.userEvent // SCSS 클래스 매핑
                        : classNames[0] === 'holiday-event'
                        ? CalendarStyle.holidayEvent
                        : ''; // 기본값
                }}
                datesSet={handleDatesSet}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
            />

            <Modal open={modalOpen} onClose={closeModal}>
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 400,
                        bgcolor: 'background.paper',
                        boxShadow: 24,
                        p: 4,
                        borderRadius: 2,
                    }}
                >
                    <h2>
                        {modalType === 'add' ? '새 일정 추가' : '일정 수정'}
                    </h2>
                    <TextField
                        fullWidth
                        label="일정 제목"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: 1,
                        }}
                    >
                        {title && (
                            <Button
                                variant="contained"
                                color="error"
                                onClick={() => handleDelete(selectedEvent.id)}
                            >
                                삭제
                            </Button>
                        )}

                        <Button variant="outlined" onClick={closeModal}>
                            취소
                        </Button>
                        <Button variant="contained" onClick={handleSave}>
                            확인
                        </Button>
                    </Box>
                </Box>
            </Modal>
        </div>
    );
}

export default Calendar;
