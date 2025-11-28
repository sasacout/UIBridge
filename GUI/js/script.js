// ---------------------------------------------------------
// 이 스크립트는 Sketch MeaXure 플러그인으로 출력한 HTML Guide 형식의 디자인 가이드 검수 작업에 도움을 주는 UI와 기능을 추가합니다.
// Script to help review HTML files extracted with the Sketch App's MeaXure Plug-in.
// MeaXure 플러그인은 다음 링크를 참조하세요. https://github.com/qjebbs/sketch-meaxure
// ---------------------------------------------------------
// 이 스크립트는 저작자의 허가 없는 수정, 무단 복제 및 배포를 금지합니다.
// (c) 2022 BOEUNDE. All rights reserved. 
// (c) https://github.com/boeunde/MeaXure-Tamperer
// ---------------------------------------------------------
// **Revision History**
//
// **v0.9 22.10.21 Created**
// 1) header 우상단에 앞뒤 페이지 이동 버튼 (<, >) 기능 추가
// 2) page load 시 artboard list에서 current page를 eye level로 고정하는 기능 추가
//
// **v1.0 24.03.21 Updated**
// 1) 앞뒤 페이지 이동 단축키([/], A/D, PgUp/PgDn) 추가 및 상호작용(tooltip, feedback) 추가
// 2) 가장 앞, 뒤 페이지 이동 기능 단축키(Home, End) 추가 및 상호작용(feedback) 추가
// 3) 페이지 진동과 같은 불편 현상 개선을 위해 viewer inner scroll 비활성화 처리
// 4) header 내 불필요한 elements (Flow, Note Switch) 비활성화 처리
// 5) 뷰어 좌측 하단에 현재 페이지 번호 표시 기능 추가
// 6) 숫자(0~999) + enter 키 입력 시 해당 번호의 페이지로 이동하는 등의 Page-jump 기능 추가
//
// **v1.1 24.03.28 Updated**
// 1) 확대, 축소 단축키(Z/C, +/-, =/-) 추가 및 상호작용 추가
// 2) 단축키 PgUp, PgDn으로 이용 시 artboard list가 scroll되지 않도록 방지 처리
// 3) artboard 이름에 'cover', 'index', 'history'가 포함된 페이지를 Shortcut List로 만드는 Section shortcut list 기능 추가, 단축키(X)를 이용한 토글 기능 추가
// 4) 앞뒤 페이지 이동 관련 단축키(Arrow, W/D)와 마우스 휠 기능 추가, artboards/slices/colors 탭 전환 단축키(Q/E/R) 추가
// 5) 현재 보고 있는 화면에 활성화되어있는 bounds 수 표시 기능 추가
// 6) 빠른 페이지 이동 시 발생하는 screen blinking(섬광) 현상 최소화를 위한 screen frame black 처리
// 7) 전체 단축키 tooltip 및 UX Writing 수정
// 8) 전체 코드 최적화
//
// **v1.2 24.04.30 Updated**
// 1) Section shortcut list의 페이지 이름이 숫자로 시작할 경우 들여쓰기를 적용하여 가독성 강화
//
// **v1.3 24.08.20 Updated**
// 1) Section shortcut list를 생성하는 조건 중 'index' 제거하고 '목차'로 수정
//
// **v1.4 24.09.02 Updated**
// 1) Ctrl+F 기능 사용을 위해 기본 F키로 작동하던 Sidebar 접기 기능 방지 처리
// ---------------------------------------------------------

console.log('%cMeaXure-Tamperer (c) 2022 BOEUNDE. All rights reserved.','font-size: 17px'); 
console.log('https://github.com/boeunde/MeaXure-Tamperer'); 


///// Default elements clean up
const flowModeElements = document.querySelectorAll('.flow-mode');
const showNotesElements = document.querySelectorAll('.show-notes');
const preventScroll = document.querySelectorAll('.screen-viewer');
flowModeElements.forEach(element => {element.style.display = 'none';});
showNotesElements.forEach(element => {element.style.display = 'none';});
preventScroll.forEach(element => {element.style.overflow = 'hidden';});


///// Create style in <head> for header buttons
const style_headerButtons = document.createElement('style');
style_headerButtons.textContent = `
    /* Usability setting */
    body {
        -webkit-user-select: text; !important;
    }
    #screen {
        background-color: #000 ! important;
    }

    /* Header buttons */
    #btn_prev, #btn_next {
        width: 60px;
        height: 100%;
        cursor: pointer;
        position: relative;
        right: 0;
    }
    #btn_prev:hover, #btn_next:hover,
    #btn_prev.btn_hover, #btn_next.btn_hover{
        background-color: rgba(255, 255, 255, 0.15);
    }
    #btn_prev:after, #btn_prev:before,
    #btn_next:after, #btn_next:before {
        content: '';
        background-color: rgba(150, 150, 150, 1);
        width: 15px;
        height: 3px;
        position: absolute;
    }
    #btn_prev:after, #btn_next:before {top: 40%; left: 40%;}
    #btn_prev:before, #btn_next:after {top: 55%; left: 40%;}
    #btn_prev:after, #btn_next:after {transform: rotate(-45deg);}
    #btn_prev:before, #btn_next:before {transform: rotate(45deg);}

    #btn_prev.end_page, #btn_prev:hover.end_page,
    #btn_next.end_page, #btn_next:hover.end_page {
        cursor: default;
        opacity: 0.2;
        background-color: rgba(255, 255, 255, 0);
    }

    .zoom-out:hover, .zoom-in:hover,
    .zoom-out.hover, .zoom-in.hover {
        background-color: rgb(52, 132, 245, .6);
    }

    li.icon-artboards:hover,
    li.icon-slices:hover,
    li.icon-colors:hover {
        background-color: rgba(255, 255, 255, 0.15);
    }
    li.icon-artboards.current:hover,
    li.icon-slices.current:hover,
    li.icon-colors.current:hover {
        background-color: #232527;
    }
`;
document.head.appendChild(style_headerButtons);


///// [Common] Check the all artboards
const artboards = document.getElementById('artboards');
const target = document.getElementsByClassName('artboard');
const artboard_MAX_count = target.length;
const regex_for_number = /[^0-9]/g;


///// Create page buttons in <head>
const header = document.querySelector('.header-center');
const buttonPrev = document.createElement('div'); buttonPrev.id = 'btn_prev'; buttonPrev.title = 'Previous page\n( A / W / [ / ↑ / ← )';
const buttonNext = document.createElement('div'); buttonNext.id = 'btn_next'; buttonNext.title = 'Next page\n( D / S / ] / ↓ / → )';
const buttonZoomOutTitle = document.querySelector('.zoom-out'); buttonZoomOutTitle.title = 'Zoom in\n( Z )';
const buttonZoomInTitle = document.querySelector('.zoom-in'); buttonZoomInTitle.title = 'Zoom out\n( C )';
header.appendChild(buttonPrev);
header.appendChild(buttonNext);


//// [Common] Page number extraction
function extractPageNumber() {
    const href_split = window.location.href.split('#');
    const page_number_whole = href_split.length > 1 ? href_split[1] : '';
    return page_number_whole.replace(/[^0-9]/g, "");
};


//// Page condition detection
function checkPageCondition() {
    const page_number_only = extractPageNumber();
    const buttonPrev = document.getElementById('btn_prev');
    const buttonNext = document.getElementById('btn_next');
    buttonPrev.classList.remove('end_page');
    buttonNext.classList.remove('end_page');

    setTimeout(function() {
        buttonPrev.classList.remove('btn_hover');
        buttonNext.classList.remove('btn_hover');
    }, 150);

    if (!page_number_only || page_number_only === '0') {
        // console.log('This is first page.');
        buttonPrev.classList.add('end_page');
    } else {
        if (page_number_only == (artboard_MAX_count - 1)) {
            // console.log('This is end page.');
            buttonNext.classList.add('end_page');
        } else {
            // console.log('This page number is #s' + page_number_only);
        }
    }
};


//// Event handler for DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    checkPageCondition();
});


//// Event handler for hashchange
window.addEventListener('hashchange', function() {
    checkPageCondition();
});


//// Event handler for button click
const buttonPrevClick = document.getElementById('btn_prev');
buttonPrevClick.addEventListener('click', function() {
    const currentPageNumber = Number(extractPageNumber());
    if (currentPageNumber > 0) {
        const newURL = window.location.href.split('#')[0] + '#s' + (currentPageNumber - 1);
        window.location.href = newURL;
    }
});
const buttonNextClick = document.getElementById('btn_next');
buttonNextClick.addEventListener('click', function() {
    const currentPageNumber = Number(extractPageNumber());
    if (currentPageNumber < artboard_MAX_count - 1) {
        const nextPageNumber = currentPageNumber + 1;
        const newURL = window.location.href.split('#')[0] + '#s' + nextPageNumber;
        window.location.href = newURL;
}});


//// Event handler for key press or mouse wheel
document.addEventListener('keydown', function(event) {
    if (event.key === 'a' || event.key === 'A' || event.key === '[' || event.key === 'PageUp' || event.key === 'w' || event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        event.stopPropagation();
        const currentPageNumber = Number(extractPageNumber());
        if (currentPageNumber > 0) {
            const newURL = window.location.href.split('#')[0] + '#s' + (currentPageNumber - 1);
            buttonPrev.classList.add('btn_hover');
            window.location.href = newURL;
        }
    }
});
document.addEventListener('wheel', function(event) {
    if (event.deltaY < 0) {
        const currentPageNumber = Number(extractPageNumber());
        if (currentPageNumber > 0) {
            event.preventDefault();
            event.stopPropagation();
            const newURL = window.location.href.split('#')[0] + '#s' + (currentPageNumber - 1);
            buttonPrev.classList.add('btn_hover');
            window.location.href = newURL;
        }
    }
}, { passive: false });
document.addEventListener('keydown', function(event) {
    const currentPageNumber = Number(extractPageNumber());
    if ((event.key === 'd' || event.key === 'D' || event.key === ']' || event.key === 'PageDown' || event.key === 's' || event.key === 'ArrowDown' || event.key === 'ArrowRight') && currentPageNumber < artboard_MAX_count - 1) {
        event.preventDefault();
        event.stopPropagation();
        if (currentPageNumber < artboard_MAX_count - 1) {
            const nextPageNumber = currentPageNumber + 1;
            const newURL = window.location.href.split('#')[0] + '#s' + nextPageNumber;
            window.location.href = newURL;
            buttonNext.classList.add('btn_hover');
        }
    }
});
document.addEventListener('wheel', function(event) {
    if (event.deltaY > 0) {
        const currentPageNumber = Number(extractPageNumber());
        if (currentPageNumber < artboard_MAX_count - 1) {
            event.preventDefault();
            event.stopPropagation();
            const nextPageNumber = currentPageNumber + 1;
            const newURL = window.location.href.split('#')[0] + '#s' + nextPageNumber;
            window.location.href = newURL;
            buttonNext.classList.add('btn_hover');
        }
    }
}, { passive: false });
document.addEventListener('keydown', function(event) {
    const labelZoomLevel = document.querySelector('.zoom-text');
    const buttonZoomOut = document.querySelector('.zoom-out');
    const buttonZoomIn = document.querySelector('.zoom-in');
    
    if (labelZoomLevel) {
        if (event.key === 'z' || event.key === 'Z' || event.key === '=' || event.key === '+') {
            if (labelZoomLevel.textContent.trim() !== '400%' && buttonZoomOut) {
                buttonZoomOut.click();
                setTimeout(function() {
                    const newButtonZoomOut = document.querySelector('.zoom-out');
                    const newButtonZoomIn = document.querySelector('.zoom-in');
                    if (newButtonZoomOut) {
                        newButtonZoomOut.title = 'Zoom in\n( Z )';
                        newButtonZoomIn.title = 'Zoom out\n( C )';
                        newButtonZoomOut.classList.add('hover');
                        setTimeout(function() {
                            newButtonZoomOut.classList.remove('hover');
                        }, 150);
                    }
                }, 0);
            }
        } else if (event.key === 'c' || event.key === 'C' || event.key === '-') {
            if (labelZoomLevel.textContent.trim() !== '25%' && buttonZoomIn) {
                buttonZoomIn.click();
                setTimeout(function() {
                    const newButtonZoomOut = document.querySelector('.zoom-out');
                    const newButtonZoomIn = document.querySelector('.zoom-in');
                    if (newButtonZoomIn) {
                        newButtonZoomOut.title = 'Zoom in\n( Z )';
                        newButtonZoomIn.title = 'Zoom out\n( C )';
                        newButtonZoomIn.classList.add('hover');
                        setTimeout(function() {
                            newButtonZoomIn.classList.remove('hover');
                        }, 150);
                    }
                }, 0);
            }
        }
    }
});
document.addEventListener('keydown', function(event) {
    if (event.key === 'Home') {
        window.location.href = window.location.href.split('#')[0] + '#s0';
    } else if (event.key === 'End') {
        window.location.href = window.location.href.split('#')[0] + '#s' + (artboard_MAX_count - 1);
    }
});
const liArtboards = document.querySelector('li.icon-artboards'); liArtboards.title = 'Artboards\n( Q )';
const liSlices = document.querySelector('li.icon-slices'); liSlices.title = 'Slices\n( E )';
const liColors = document.querySelector('li.icon-colors'); liColors.title = 'Colors\n( R )';
document.addEventListener('keydown', function(event) {
    if (event.key === 'q' || event.key === 'Q') {
        const slicesIcon = document.querySelector('li.icon-artboards');
        if (slicesIcon) {
            slicesIcon.click();
        }
    }
    if (event.key === 'e' || event.key === 'E') {
        const slicesIcon = document.querySelector('li.icon-slices');
        if (slicesIcon) {
            slicesIcon.click();
        }
    }
    if (event.key === 'r' || event.key === 'R') {
        const slicesIcon = document.querySelector('li.icon-colors');
        if (slicesIcon) {
            slicesIcon.click();
        }
    }
});


//// Focus of artboard list fixed on eyelevel
function Screen_inspection() {
    let present_url = (window.location.href).split('#');
    let present_page = present_url[1];
    let present_page_num = 0
    if (present_page === undefined) {
        present_page = 0;
    } else {
        present_page_num = present_page.replace(/[^0-9]/g, "");
    }
};
window.addEventListener('hashchange', (e) => {
    let bp = e.oldURL.split('#');
    let np = e.newURL.split('#');
    let bp_number = 0;
    let eye_level = 250;

    if (bp[1] !== undefined) {
        bp_number = Number(bp[1].replace(regex_for_number, ""));
    }
    let np_number = Number(np[1].replace(regex_for_number, ""));

    Screen_inspection();

    if (bp_number < np_number) {
        for (let i = Number(target[np_number].getBoundingClientRect().y); i > eye_level; i--) {
            artboards.scrollTop++;
        }
    } else {
        for (let i = Number(target[np_number].getBoundingClientRect().y); i < eye_level; i++) {
            artboards.scrollTop--;
        }
    }
});


///// Create style in <head> for page helper guide
const style_pageHelper = document.createElement('style');
style_pageHelper.textContent = `
    /* Page helpers */

    #page-jumper-guide,
    #page-section-guide {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.25);

        z-index: 999;
        position: absolute;
        bottom: 10px;
        right: 10px;

        filter: drop-shadow(0 1px rgba(20, 20, 20, .95));
    }
    #page-section-guide {
        left: 250px;
        bottom: 10px;
    }
    
    #page-helper-group {
        display: flex;
        flex-direction: row;

        z-index: 999;
        position: fixed;
        top: 70px;
        left: 250px;
    }
    #page-number {
        font-size: 12px;
        color: rgba(255, 255, 255, .8);
        display: inline-block;
        margin-right: 12px;

        filter: drop-shadow(0 1px rgba(20, 20, 20, .95));
    }
    #page-number:after {
        content: '';
        width: 2px;
        height: 11px;
        background-color: rgba(255, 255, 255, .4);
        position: absolute;
        top: 1px;
        right: -12px;
        
    }
    @keyframes bounce {
        45% { transform:translateY(-15%); }
        55% { transform:translateY(-15%); }
        100% { transform:translateY(0); }
    }
    .bounce {
        animation: bounce 0.25s ease-out;
    }

    #page-layers {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.4);
        display: inline-block;
        margin-left: 12px;

        filter: drop-shadow(0 1px rgba(20, 20, 20, .95));
    }

    #page-jumper {
        font-size: 30px;

        z-index: 999;
        position: absolute;
        bottom: 30px;
        right: 10px;
    }
    #page-jump-reject {
        font-size: 12px;

        z-index: 999;
        position: absolute;
        bottom: 66px;
        right: 12px;
    }
    @keyframes shake {
        0% { transform: translateX(0); }
        20% { transform: translateX(-3px); }
        40% { transform: translateX(3px); }
        60% { transform: translateX(-3px); }
        80% { transform: translateX(3px); }
        100% { transform: translateX(0); }
    }
    .shake {
        animation: shake 0.25s ease-out;
    }
`;
document.head.appendChild(style_pageHelper);


//// Add page helper group and bouncing at reload
function initializePageHelperGroup() {
    const existingGroup = document.getElementById('page-helper-group');
    if (existingGroup) {
        existingGroup.remove();
    }

    const pageHelperGroup = document.createElement('div');
    pageHelperGroup.id = 'page-helper-group';
    pageHelperGroup.className = 'bounce';
    document.body.appendChild(pageHelperGroup);
}
window.addEventListener('load', initializePageHelperGroup);
window.addEventListener('hashchange', initializePageHelperGroup);


//// Add display for the current page number
function updatePageNumber() {
    return parseInt(window.location.hash.substring(2)) || 0;
}
function updateCurrentPageDisplay() {
    let currentPageDisplay = document.getElementById('page-number');
    if (!currentPageDisplay) {
        currentPageDisplay = document.createElement('div');
        currentPageDisplay.id = 'page-number';
        document.getElementById('page-helper-group').appendChild(currentPageDisplay);
    }
    currentPageDisplay.textContent = '#s' + updatePageNumber();
}
window.addEventListener('load', updateCurrentPageDisplay);
window.addEventListener('hashchange', updateCurrentPageDisplay);


//// Add display for number of layers
function countDivsInLayers() {
    const layersElement = document.getElementById('layers');
    if (!layersElement) {
        return 0;
    }

    const divElements = layersElement.querySelectorAll('div');
    
    return divElements.length;
}
function updateDivCountDisplay() {
    const divCount = countDivsInLayers();
    
    let displayElement = document.getElementById('page-layers');
    
    if (!displayElement) {
        displayElement = document.createElement('div');
        displayElement.id = 'page-layers';
        displayElement.textContent = 'Number of bounds in screen: ' + divCount;
        document.getElementById('page-helper-group').appendChild(displayElement);
    } else {
        displayElement.textContent = 'Number of bounds in screen: ' + divCount;
    }
}
window.addEventListener('load', updateDivCountDisplay);
window.addEventListener('hashchange', updateDivCountDisplay);


//// Add guide text for page helper
const guideJumperDisplay = document.createElement('div'); guideJumperDisplay.id = 'page-jumper-guide';
guideJumperDisplay.textContent = 'Press Number(0~999) + Enter keys to Page-jump!';
document.body.appendChild(guideJumperDisplay);
const guideSectionDisplay = document.createElement('div'); guideSectionDisplay.id = 'page-section-guide';
guideSectionDisplay.textContent = 'Press X key to view all sections';
document.body.appendChild(guideSectionDisplay);


//// Pager jumper
let jumpPage = '';
let lastInputTime = Date.now();

document.addEventListener('keydown', function(event) {
    const keyPressed = event.key;

    if (keyPressed === ' ') {
        event.preventDefault();
        return;
    }

    if (event.key === 'Enter' || event.key === 'NumpadEnter') {
        if (jumpPage !== '') {
            const pageNumber = parseInt(jumpPage, 10);
            const artboard_MAX_count = document.getElementsByClassName('artboard').length;

            if (pageNumber > artboard_MAX_count - 1) {
                jumpPage = '';
                const existingNotice = document.getElementById('page-jump-reject');
                if (existingNotice) {
                    existingNotice.remove();
                }
                const displayNotice = document.createElement('div');
                displayNotice.textContent = 'Please enter it again';
                displayNotice.id = 'page-jump-reject';
                
                if (jumpPage === '') {
                    const displayElement = document.getElementById('page-jumper');
                    if (displayElement) {
                        displayElement.textContent = 'jump to #s_';
                    }
                }
                displayNotice.className = 'shake';
                document.body.appendChild(displayNotice);

                setTimeout(function() {
                    if (displayNotice) {
                        displayNotice.remove();
                    }
                }, 3000);
            } else {
                const currentURL = window.location.href;
                const newURL = currentURL.split('#')[0] + '#s' + pageNumber;
                window.location.href = newURL;
                jumpPage = '';
                const displayElement = document.getElementById('page-jumper');
                if (displayElement) {
                    displayElement.remove();
                }
                const displayNotice = document.getElementById('page-jump-reject');
                if (displayNotice) {
                    displayNotice.remove();
                }
            }
        }
    }

    else if (keyPressed === 'Escape') {
        jumpPage = '';
        const displayElement = document.getElementById('page-jumper');
        if (displayElement) {
            displayElement.remove();
        }
    }

    else if (!isNaN(keyPressed) && jumpPage.length < 3) {
        jumpPage += keyPressed;
        lastInputTime = Date.now();

        const displayElement = document.createElement('div');
        displayElement.textContent = 'jump to #s' + jumpPage;
        displayElement.id = 'page-jumper';

        const existingDisplay = document.getElementById('page-jumper');
        if (existingDisplay) {
            existingDisplay.remove();
        }
        document.body.appendChild(displayElement);
    }
});
setInterval(function() {
    if (Date.now() - lastInputTime > 10000) {
        jumpPage = '';
        const displayElement = document.getElementById('page-jumper');
        if (displayElement) {
            displayElement.remove();
        }

        const displayNotice = document.getElementById('page-jump-reject');
        if (displayNotice) {
            displayNotice.remove();
        }
    }
}, 1000);


///// Create style in <head> for shortcut
const style_pageShortcut = document.createElement('style');
style_pageShortcut.textContent = `
    /* Page shortcut */

    @keyframes tada {
        0% { transform: translateX(-5px); opacity: 0; }
        100% { transform: translateX(0); opacity: 1; }
    }
    .tada {
        animation: tada .2s ease-in;
    }
    #shortcut {
        font-size: 11px;
        z-index: 999;
        position: absolute;
        display: flex;
        flex-direction: column;
        bottom: 32px;
        left: 250px;

        transition: 0.25s ease;
    }
    #shortcut > a {
        cursor: pointer;
        color: rgba(255,255,255,.4);
        padding: 4px 9px;
        border-radius: 1px;
        transition: ease-in-out 0.05s;

        filter: drop-shadow(0 1px rgba(20, 20, 20, .95));
    }
    #shortcut > a:hover {
        text-decoration: underline;
        color: rgba(255,255,255,.8);
        background-color: rgba(15, 15, 15, .8);
        padding-left: 5px;
    }
    #shortcut::before {
        content: 'Sections (X)';
        color: rgba(255,255,255,.8);
        margin-bottom: 4px;
        
        filter: drop-shadow(0 1px rgba(20,20,20, .45));
    }
    a.indent {
        margin-left: 12px;
    }
`;
document.head.appendChild(style_pageShortcut);


//// Create Sections shortcut list
function createLink(liElement, textContent) {
    const aElement = document.createElement('a');
    aElement.textContent = textContent;
    aElement.addEventListener('click', function() {
        liElement.click();
    });
    return aElement;
}


//// Event each time when page loaded
window.addEventListener('load', function() {
    const shortcutDiv = document.createElement('div');
    shortcutDiv.id = 'shortcut';
    shortcutDiv.className = 'tada';
    let lastHistoryParent = null;
    const pictureElements = document.querySelectorAll('picture');
    pictureElements.forEach(pictureElement => {
        const dataName = pictureElement.getAttribute('data-name');
        if (dataName && (dataName.toLowerCase().includes('cover') || dataName.toLowerCase().includes('history') || dataName.toLowerCase().includes('목차'))) {
            const liElement = pictureElement.parentElement;
            if (dataName.toLowerCase().includes('history')) {
                lastHistoryParent = liElement;
            } else {
                liElement.style.borderTop = '2px solid #191A1E';
                const smallElement = liElement.querySelector('small');
                if (smallElement) {
                    const dataIndex = liElement.dataset.index;
                    const linkText = `${smallElement.textContent} - [#s${dataIndex}]`;
                    const aElement = createLink(liElement, linkText);
                    shortcutDiv.appendChild(aElement);
                }
            }
        }
    });
    if (lastHistoryParent) {
        const smallElement = lastHistoryParent.querySelector('small');
        if (smallElement) {
            const dataIndex = lastHistoryParent.dataset.index;
            const linkText = `${smallElement.textContent} - [#s${dataIndex}]`;
            const aElement = createLink(lastHistoryParent, linkText);
            if (shortcutDiv.children.length > 1) { 
                shortcutDiv.insertBefore(aElement, shortcutDiv.children[1]);
            } else {
                shortcutDiv.appendChild(aElement);
            }
        }
    }
    document.body.appendChild(shortcutDiv);
    document.addEventListener('keydown', function(event) {
        if (event.key === 'x' || event.key === 'X') {
            const displayValue = shortcutDiv.style.display;
            if (displayValue === 'none') {
                shortcutDiv.style.display = 'flex';
            } else {
                shortcutDiv.style.display = 'none';
            }
        }
    });
});


//// Sections shortcut list indent
window.addEventListener('load', function() {
    const shortcutDiv = document.getElementById('shortcut');
    if (!shortcutDiv) return;

    const allLinks = shortcutDiv.getElementsByTagName('a');
    for (let i = 0; i < allLinks.length; i++) {
        const link = allLinks[i];
        const firstChar = link.textContent.trim()[0];
        if (!isNaN(parseInt(firstChar))) {
            link.classList.add('indent');
        }
    }
});


//// Prevent F Key
window.addEventListener('DOMContentLoaded', function() {
    let slidebox = document.querySelector('.slidebox[title*="Keyboard shortcut: f"]');
    if (slidebox) {
        slidebox.remove();
    }
});
