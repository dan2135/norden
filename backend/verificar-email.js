require('dotenv').config({path:require('node:path').join(__dirname,'.env'),quiet:true});
const { configuracaoEmail } = require('./email');
async function main() {
  const config=configuracaoEmail();
  if(config.modo!=='smtp') throw new Error('Configure SMTP primeiro.');
  const transporte=require('nodemailer').createTransport(config.transporte);
  try {await transporte.verify();console.log('Conexão SMTP e autenticação verificadas. Nenhum e-mail foi enviado.');}
  finally {transporte.close();}
}
main().catch(()=>{console.error('Não foi possível verificar SMTP. Confira modo, servidor, porta, credenciais e remetente.');process.exitCode=1;});
