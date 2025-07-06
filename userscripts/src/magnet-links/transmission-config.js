const conf_storage_key = 'magnet-links--config';

// example: {
//     host : '192.168.11.1' ,
//     port : 1234 ,
//     username : 'USERNAM' ,
//     password : 'PASSWOR' ,
//     ssl : false ,
//     download_dir : '/mnt/nas/downloads' ,
// }

module.exports = {
    getConfig : () => {
        const conf_str = GM_getValue(conf_storage_key , '') + '';
        try {
            const conf = JSON.parse(conf_str) ?? {};
            const {host , port = 9091 , username , password , ssl = false , download_dir} = conf;
            return {host , port , username , password , ssl , download_dir};
        } catch (err) {
            return {host : '' , port : 9091 , username : '' , password : '' , ssl : false , download_dir : '/tmp'};
        }
    } ,
    setConfig : ({host , port , username , password , ssl , download_dir} = {}) => {
        GM_setValue(conf_storage_key , JSON.stringify({
            host : host.trim() ,
            port : parseInt(port) ,
            username : username.trim() ,
            password : password.trim() ,
            ssl : ssl ?? false ,
            download_dir : download_dir.trim() ,
        }));
    } ,
};
