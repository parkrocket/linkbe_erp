import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { BUSINESS_INFO, COPYRIGHT } from '@/components/layout/Footer';
import { AdminMock, CalendarMock, SlackApplyMock, WorkMock } from './LandingMockups';

// 새 원페이지 랜딩 (시안 — /landing 어두운 테마, /landing/light 밝은 테마. 확정되면 '/' 로그인 전 화면으로 교체)
// 색은 globals.css 랜딩 변수(night·mist·lilac·dusk 등) — 테마는 data-landing 값으로 변수만 바꿈
// 핵심 장치: hi(출근 인사)와 bye(퇴근 인사)를 잇는 하루 선. 움직임은 첫 화면 이 한 번만(globals.css .day-line)

// 하루 선 위의 일 — at: 가로 위치(%), d: 켜지는 시각(애니메이션 지연)
const DAY_EVENTS = [
    { time: '09:12', text: 'Slack에서 연차 신청', at: 8, d: '0.6s' },
    { time: '09:13', text: '승인되고 캘린더에 등록', at: 33, d: '0.9s' },
    { time: '14:30', text: '경비 기안', at: 60, d: '1.2s' },
    { time: '17:50', text: '견적서 인쇄', at: 86, d: '1.5s' },
];

const RULES = [
    { value: '+1일', text: '매달 1일, 올해 입사한 직원에게 월차가 자동으로 더해져요.' },
    { value: '월 2회', text: '재택은 한 달에 두 번까지. 넘으면 신청할 때 바로 알려 줘요.' },
    { value: '주말 제외', text: '주말과 지난 날짜에는 신청할 수 없어요. 하루라도 안 되면 전체를 다시 확인해요.' },
    { value: '모두 기록', text: '연차·휴가 일수가 바뀔 때마다 누가, 왜 바꿨는지 장부에 남아요.' },
];

const STEPS = [
    { title: '회원가입', text: '회사와 입사일을 입력하고 가입 신청을 보내요.' },
    { title: '관리자 승인', text: '관리자가 확인하고 승인하면 바로 쓸 수 있어요.' },
    { title: 'Slack이나 웹에서 사용', text: 'Slack 앱 홈에서 신청하거나 hibye.kr에서 모든 기능을 써요.' },
];

const linkFocus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lilac';
const primaryButton = `inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#6d3ad0] ${linkFocus}`;
const quietButton = `inline-flex items-center justify-center rounded-xl border border-night-line px-5 py-3 text-sm font-semibold text-mist transition-colors hover:border-haze ${linkFocus}`;

export function HibyeLanding({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
    return (
        <div data-landing={theme} className="flex flex-1 flex-col bg-night text-mist">
            <LandingNav />
            <main className="flex-1">
                <Hero />
                <Features />
                <Rules />
                <Steps />
                <Closing />
            </main>
            <LandingFooter />
        </div>
    );
}

function LandingNav() {
    return (
        <header className="sticky top-0 z-20 border-b border-night-line/60 bg-night/80 backdrop-blur">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-8 px-4">
                <Link href="/" className={`shrink-0 text-xl font-extrabold tracking-tight text-mist ${linkFocus}`}>
                    LinkBe<span className="sr-only"> hibye 홈</span>
                </Link>
                <nav aria-label="랜딩 메뉴" className="hidden gap-6 text-sm text-haze md:flex">
                    <a href="#features" className={`hover:text-mist ${linkFocus}`}>기능</a>
                    <a href="#rules" className={`hover:text-mist ${linkFocus}`}>자동 규칙</a>
                    <a href="#start" className={`hover:text-mist ${linkFocus}`}>시작하기</a>
                </nav>
                <Link href="/login" className={`ml-auto rounded-lg bg-mist px-4 py-2 text-sm font-semibold text-night hover:opacity-90 ${linkFocus}`}>
                    로그인
                </Link>
            </div>
        </header>
    );
}

function Hero() {
    return (
        <section className="relative overflow-hidden">
            {/* 아침(왼쪽 위 라일락)과 저녁(오른쪽 아래 노을) 빛 */}
            <div aria-hidden className="pointer-events-none absolute -top-40 -left-40 size-[36rem] rounded-full bg-(--glow-hi) blur-[120px]" />
            <div aria-hidden className="pointer-events-none absolute -right-40 bottom-0 size-[28rem] rounded-full bg-(--glow-bye) blur-[120px]" />

            <div className="relative mx-auto w-full max-w-6xl px-4 pt-14 pb-20 md:pt-20 md:pb-28">
                <div aria-hidden className="flex items-end justify-between text-[clamp(5.5rem,20vw,15rem)] leading-[0.8] font-black tracking-[-0.07em] select-none">
                    <span className="bg-gradient-to-b from-hi-from to-lilac bg-clip-text text-transparent">hi</span>
                    <span className="bg-gradient-to-b from-bye-from to-dusk bg-clip-text text-transparent">bye</span>
                </div>

                <DayLine />

                <div className="mt-14 max-w-2xl md:mt-20">
                    <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-strong md:text-5xl md:leading-[1.15]">
                        출근 인사부터 퇴근 인사까지,
                        <br />
                        링크비의 하루가 여기 있어요
                    </h1>
                    <p className="mt-5 text-base leading-7 text-haze md:text-lg md:leading-8">
                        근태 신청과 팀 일정, 경비와 견적까지. Slack과 웹 어디서 해도 같은 규칙으로 처리돼요.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link href="/login" className={primaryButton}>
                            로그인
                        </Link>
                        <Link href="/register" className={quietButton}>
                            회원가입
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

// 하루 선 — 모바일은 세로 목록, 데스크톱은 hi 아래에서 bye 아래까지 가로 선
function DayLine() {
    return (
        <div className="relative mt-8 md:mt-10 md:h-28">
            <div
                aria-hidden
                className="day-line absolute top-0 bottom-0 left-[4.5px] w-0.5 bg-gradient-to-b from-lilac to-dusk md:top-[21.5px] md:right-0 md:bottom-auto md:left-0 md:h-0.5 md:w-auto md:bg-gradient-to-r"
            />
            <ol aria-label="hibye로 보내는 하루" className="relative space-y-5 md:space-y-0">
                {DAY_EVENTS.map(e => (
                    <li
                        key={e.time}
                        className="day-event flex items-center gap-4 md:absolute md:top-0 md:left-(--at) md:block md:w-44 md:-translate-x-1/2"
                        style={{ '--d': e.d, '--at': `${e.at}%` } as CSSProperties}
                    >
                        <span aria-hidden className="relative z-10 block size-[11px] shrink-0 rounded-full border-2 border-night bg-mist shadow-[0_0_0_4px_rgba(185,163,240,0.25)] md:mx-auto md:mt-[17px]" />
                        <span className="md:mt-3 md:block md:text-center">
                            <span className="block text-xs tabular-nums text-lilac md:text-sm">{e.time}</span>
                            <span className="block text-sm text-mist">{e.text}</span>
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

function Features() {
    return (
        <section id="features" aria-labelledby="features-title" className="scroll-mt-16 border-t border-night-line/60 bg-night-2/40">
            <div className="mx-auto w-full max-w-6xl px-4 py-20 md:py-28">
                <h2 id="features-title" className="max-w-xl text-2xl font-extrabold tracking-tight text-balance break-keep text-strong md:text-4xl">
                    하루 동안 쓰는 것들이 한곳에
                </h2>
                <div className="mt-12 grid gap-4 md:grid-cols-6">
                    <Feature className="md:col-span-4" title="근태" text="연차·반차·휴가·재택을 Slack에서 바로 신청해요. 남은 일수를 보여 주고, 신청하면 회사 캘린더에 자동으로 올라가요." big>
                        <SlackApplyMock />
                    </Feature>
                    <Feature className="md:col-span-2" title="일정" text="공휴일과 팀원의 근태, 회사 일정을 한 달력에서 봐요.">
                        <CalendarMock />
                    </Feature>
                    <Feature className="md:col-span-3" title="업무" text="경비 기안과 승인, 견적서·계약서 작성과 인쇄, 매출·매입 장부를 정리해요.">
                        <WorkMock />
                    </Feature>
                    <Feature className="md:col-span-3" title="관리" text="가입 승인, 직원 정보와 조직, 연차 일괄 조정을 관리자가 한 화면에서 처리해요.">
                        <AdminMock />
                    </Feature>
                </div>
                <p className="mt-6 text-sm text-haze">회사 홈페이지(linkbe.kr)의 문의와 주문, 공지·포트폴리오도 hibye에서 관리해요.</p>
            </div>
        </section>
    );
}

function Feature({ title, text, className, big = false, children }: { title: string; text: string; className: string; big?: boolean; children: ReactNode }) {
    return (
        <article className={`flex flex-col gap-6 border border-night-line bg-night-2 p-6 md:p-7 ${big ? 'rounded-[28px]' : 'rounded-2xl'} ${className}`}>
            <div>
                <h3 className={`font-bold text-strong ${big ? 'text-2xl' : 'text-lg'}`}>{title}</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-haze">{text}</p>
            </div>
            <div className="mt-auto">{children}</div>
        </article>
    );
}

function Rules() {
    return (
        <section id="rules" aria-labelledby="rules-title" className="scroll-mt-16">
            <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 md:grid-cols-[1fr_1.6fr] md:py-28">
                <div>
                    <h2 id="rules-title" className="text-2xl font-extrabold tracking-tight text-balance break-keep text-strong md:text-4xl">
                        사람이 기억하지 않아도 되는 규칙
                    </h2>
                    <p className="mt-4 text-sm leading-6 text-haze">웹에서 신청하든 Slack에서 신청하든 서버가 같은 규칙으로 확인해요.</p>
                </div>
                <dl className="divide-y divide-night-line border-y border-night-line">
                    {RULES.map(r => (
                        <div key={r.value} className="grid gap-1 py-6 sm:grid-cols-[9rem_1fr] sm:gap-6">
                            <dt className="text-2xl font-extrabold tracking-tight text-lilac">{r.value}</dt>
                            <dd className="self-center text-[15px] leading-7 text-mist/90">{r.text}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </section>
    );
}

function Steps() {
    return (
        <section id="start" aria-labelledby="start-title" className="scroll-mt-16 border-t border-night-line/60 bg-night-2/40">
            <div className="mx-auto w-full max-w-6xl px-4 py-20 md:py-28">
                <h2 id="start-title" className="text-2xl font-extrabold tracking-tight text-balance break-keep text-strong md:text-4xl">
                    시작하는 방법
                </h2>
                <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
                    {STEPS.map((s, i) => (
                        <li key={s.title} className="border-t-2 border-primary pt-5">
                            <span className="text-sm font-bold tabular-nums text-lilac">{i + 1}단계</span>
                            <h3 className="mt-2 text-lg font-bold text-strong">{s.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-haze">{s.text}</p>
                        </li>
                    ))}
                </ol>
                <p className="mt-12 text-sm text-haze">승인된 계정만 들어올 수 있고, 계정이 비활성화되면 그 즉시 막혀요. 민감한 정보는 암호화해 보관해요.</p>
            </div>
        </section>
    );
}

// 마무리 — 첫 화면의 hi와 짝을 이루는 bye
function Closing() {
    return (
        <section aria-labelledby="closing-title" className="relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute -bottom-48 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-(--glow-bye) blur-[120px]" />
            <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-4 py-24 md:flex-row md:items-end md:justify-between md:py-32">
                <div>
                    <h2 id="closing-title" className="text-3xl font-extrabold tracking-tight text-strong md:text-5xl">
                        링크비 구성원이라면
                        <br />
                        지금 가입하세요
                    </h2>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link href="/register" className={primaryButton}>
                            회원가입
                        </Link>
                        <Link href="/login" className={quietButton}>
                            로그인
                        </Link>
                    </div>
                </div>
                <span aria-hidden className="bg-gradient-to-b from-bye-from to-dusk bg-clip-text text-[clamp(4rem,12vw,9rem)] leading-none font-black tracking-[-0.07em] text-transparent select-none">
                    bye
                </span>
            </div>
        </section>
    );
}

function LandingFooter() {
    return (
        <footer className="border-t border-night-line/60">
            <div className="mx-auto w-full max-w-6xl px-4 py-10 text-xs leading-6 text-haze">
                {BUSINESS_INFO.map(line => (
                    <p key={line}>{line}</p>
                ))}
                <p className="mt-2">{COPYRIGHT}</p>
            </div>
        </footer>
    );
}
