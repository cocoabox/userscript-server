/**
 * Sets styles on an element from a CSS dictionary
 * @param {HTMLElement} toElem - The element to style
 * @param {Object} cssDict - Dictionary of CSS properties and values
 */
function setStyle(toElem , cssDict) {
    for ( const [property , value] of Object.entries(cssDict) ) {
        // Convert kebab-case to camelCase for JavaScript style properties
        const camelCaseProperty = property.replace(/-([a-z])/g , (match , letter) => letter.toUpperCase());
        toElem.style[camelCaseProperty] = value;
    }
}

/**
 * @param {string|{text:string,title:string?,buttons:object,return_key:string?,esc_key:string?}} input
 * @return {Promise<string>}
 */
function msgbox(input) {
    if ( typeof input === 'string' ) {
        input = {
            text : input ,
            buttons : {ok : 'OK'} ,
            esc_key : 'ok' ,
            return_key : 'ok'
        };
    }
    if ( ! input.buttons ) {
        input.buttons = {ok : 'OK'};
    }
    if ( ! input.return_key ) {
        if ( 'ok' in input.buttons ) input.return_key = 'ok';
    }
    if ( ! input.esc_key ) {
        if ( 'cancel' in input.buttons ) input.esc_key = 'cancel';
    }

    const css = {
        backdrop : {
            position : 'fixed' ,
            top : '0' ,
            left : '0' ,
            width : '100vw' ,
            height : '100vh' ,
            background : 'rgba(0,0,0,0.4)' ,
            'backdrop-filter' : 'blur(4px)' ,
            display : 'flex' ,
            'align-items' : 'center' ,
            'justify-content' : 'center' ,
            'z-index' : '999999' ,
            margin : '0' ,
            'box-sizing' : 'border-box' ,
            'border-radius' : '0'
        } ,
        box : {
            background : 'white' ,
            color : '#000' ,
            border : '1px solid #ccc' ,
            'border-radius' : '8px' ,
            'max-width' : '90vw' ,
            'min-width' : '300px' ,
            'max-height' : '90vh' ,
            overflow : 'hidden' ,
            'box-shadow' : '0 4px 16px rgba(0,0,0,0.25)' ,
            'font-family' : 'sans-serif' ,
            display : 'flex' ,
            'flex-direction' : 'column' ,
            margin : '0' ,
            'box-sizing' : 'border-box' ,
            padding : '0'
        } ,
        title : {
            color : '#333 !important' ,
            background : '#f0f0f0' ,
            padding : '12px 16px' ,
            'font-weight' : 'bold' ,
            'font-size' : '16px' ,
            'border-bottom' : '1px solid #ddd' ,
            margin : '0' ,
            'box-sizing' : 'border-box'
        } ,
        body : {
            padding : '16px' ,
            'font-size' : '16px' ,
            color : '#333 !important' ,
            overflow : 'auto' ,
            margin : '0' ,
            'box-sizing' : 'border-box'
        } ,
        footer : {
            padding : '12px 16px' ,
            display : 'flex' ,
            'justify-content' : 'flex-end' ,
            gap : '8px' ,
            'border-top' : '1px solid #ddd' ,
            background : '#fafafa' ,
            margin : '0' ,
            'box-sizing' : 'border-box' ,
            'border-radius' : '0'
        } ,
        button : {
            background : '#007bff' ,
            color : 'white' ,
            border : 'none' ,
            'border-radius' : '4px' ,
            padding : '8px 16px' ,
            'font-size' : '14px' ,
            cursor : 'pointer' ,
            transition : 'background 0.2s ease'
        } ,
    };

    const backdrop = document.createElement('div');
    setStyle(backdrop , css.backdrop);

    const box = document.createElement('div');
    setStyle(box , css.box);

    if ( input.title ) {
        const title = document.createElement('div');
        setStyle(title , css.title);
        title.textContent = input.title;
        title.style.color = '#333 !important';
        box.appendChild(title);
    }

    const body = document.createElement('div');
    setStyle(body , css.body);
    body.textContent = input.text;
    body.style.color = '#333 !important';
    box.appendChild(body);

    const footer = document.createElement('div');
    setStyle(footer , css.footer);

    const result = new Promise((resolve) => {
        for ( const [key , caption] of Object.entries(input.buttons) ) {
            const isDefault = input.return_key ? input.return_key === key : false;
            const isCancel = input.esc_key ? input.esc_key === key : (['close' , 'cancel' , 'abort'].includes(key.toLowerCase()));
            const isDanger = (['delete' , 'delete-all' , 'clear'].includes(key.toLowerCase()));
            const defaultBackground = isCancel
                ? '#808080'
                : isDanger ? '#ff0000'
                    : isDefault ? '#00cc88'
                        : '#007bff';
            const hoverBackground = isCancel
                ? '#606060'
                : isDanger ? '#b30000'
                    : isDefault ? '#00b377'
                        : '#0056b3';

            const btn = document.createElement('button');
            setStyle(btn , Object.assign({} , css.button , {background : defaultBackground}));
            btn.textContent = isDefault ? `${caption} ⏎` :caption;
            btn.setAttribute('data-key' , key);

            btn.addEventListener('mouseenter' , () => {
                btn.style.background = hoverBackground;
            });
            btn.addEventListener('mouseleave' , () => {
                btn.style.background = defaultBackground;
            });

            btn.addEventListener('click' , () => {
                document.body.removeChild(backdrop);
                resolve(key);
            });

            footer.appendChild(btn);
        }

        document.addEventListener('keydown' , function handler(e) {
            if ( e.key === 'Escape' && input.esc_key ) {
                document.body.removeChild(backdrop);
                resolve(input.esc_key);

                document.removeEventListener('keydown' , handler);
            }
            if ( (e.key === 'Enter' || e.key === 'Return') && input.return_key ) {
                document.body.removeChild(backdrop);
                resolve(input.return_key);
                document.removeEventListener('keydown' , handler);
            }
        });
    });

    box.appendChild(footer);
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
    return result;
}

module.exports = msgbox;
