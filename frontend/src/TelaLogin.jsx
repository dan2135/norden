/**
 * Formulário compartilhado de primeiro acesso, login, cadastro e recuperação. Nome, e-mail e senha são preenchidos na tela e enviados à API; não são definidos neste código.
 */
import { useEffect, useRef, useState } from 'react';
import { definirCsrf, requisicao } from './api';
import './TelaLogin.css';

export default function TelaLogin({ onEntrar }) {
  const [primeiroAcesso, setPrimeiroAcesso] = useState(null);
  // A URL escolhe o formulário. O backend decide se ainda existe configuração inicial pendente.
  const parametros = new URLSearchParams(window.location.search);
  const [modo, setModo] = useState(parametros.has('redefinir') ? 'redefinir' : parametros.has('confirmar') ? 'confirmar' : parametros.get('tela') === 'cadastro' ? 'cadastro' : 'login');
  const [form, setForm] = useState({ nome: '', email: '', identificador: '', senha: '', documento: '', empresa: '', segmento: 'outros', atividade: '' });
  const [estado, setEstado] = useState({ enviando: false, erro: '' });
  const [sucesso, setSucesso] = useState('');
  const confirmacaoIniciada = useRef(false);

  useEffect(() => {
    requisicao('/auth/estado').then(({ configurado }) => setPrimeiroAcesso(!configurado))
      .catch(erro => setEstado({ enviando: false, erro: erro.message }));
  }, []);
  useEffect(() => {
    const token=parametros.get('confirmar'); if(!token || confirmacaoIniciada.current)return;
    confirmacaoIniciada.current=true;
    requisicao('/auth/confirmar-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})})
      .then(d=>{setSucesso(d.mensagem);setModo('login');history.replaceState({},'',location.pathname);})
      .catch(e=>{setEstado({enviando:false,erro:e.message});setModo('reenviar');history.replaceState({},'',location.pathname);});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar(event) {
    // Envia o formulário à rota correspondente. Não coloque login/senha fixos neste componente.
    event.preventDefault();
    setEstado({ enviando: true, erro: '' });
    try {
      const caminho = primeiroAcesso ? '/auth/configurar' : modo==='reenviar'?'/auth/reenviar-confirmacao':modo==='cadastro'?'/auth/cadastro':modo==='esqueci'?'/auth/esqueci-senha':modo==='redefinir'?'/auth/redefinir-senha':'/auth/login';
      const corpo=modo==='redefinir'?{token:parametros.get('redefinir'),senha:form.senha}:form;
      const sessao = await requisicao(caminho, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      if(modo!=='login'&&!primeiroAcesso){setForm(anterior=>({...anterior,senha:''}));setSucesso(sessao.mensagem);setModo('login');setEstado({enviando:false,erro:''});history.replaceState({},'',location.pathname);return;}
      definirCsrf(sessao.csrf_token);
      // Entrega a sessão ao aplicativo para abrir o painel sem guardar a senha no localStorage.
      onEntrar(sessao);
    } catch (erro) { setEstado({ enviando: false, erro: erro.message }); }
  }

  return <main className="login-pagina">
    <section className="login-apresentacao">
      <div className="login-marca"><span className="marca-sinal">N</span><strong>Norden</strong></div>
      <div className="login-chamada">
        <span className="etiqueta-tech">FEITO PARA SUA EMPRESA</span>
        <h1>Sua próxima ideia.<br /><em>Seu próximo projeto.</em></h1>
        <p>WhatsApp, clientes e orçamentos em um painel feito para a rotina da sua empresa.</p>
        <div className="login-recursos"><span>Projetos organizados</span><span>Orçamentos à mão</span><span>WhatsApp conectado</span></div>
      </div>
      <small>Ambiente administrativo • acesso restrito</small>
    </section>
    <section className="login-area">
      <form className="login-card" onSubmit={enviar}>
        <a href="/" style={{display:'inline-block',marginBottom:20,color:'#315de8',fontSize:14}}>← Voltar ao site</a>
        <div className="login-icone">↗</div>
        <p className="sobretitulo">{primeiroAcesso ? 'CONFIGURAÇÃO INICIAL' : modo==='confirmar'?'CONFIRMANDO E-MAIL':modo==='reenviar'?'CONFIRMAR CADASTRO':modo==='cadastro'?'NOVO CADASTRO':modo==='esqueci'?'RECUPERAR ACESSO':modo==='redefinir'?'NOVA SENHA':'ÁREA DO GESTOR'}</p>
        <h2>{modo==='confirmar'?'Validando seu link…':modo==='reenviar'?'Não recebeu a confirmação?':primeiroAcesso||modo==='cadastro'?'Crie seu acesso':modo==='esqueci'?'Esqueceu sua senha?':modo==='redefinir'?'Escolha uma nova senha':'Bem-vindo de volta'}</h2>
        <p className="login-ajuda">{modo==='confirmar'?'Aguarde enquanto verificamos seu e-mail.':modo==='reenviar'?'Informe o e-mail usado no cadastro para solicitar outro link.':modo==='esqueci'?'Enviaremos um link de recuperação ao e-mail cadastrado.':modo==='redefinir'?'Use pelo menos 10 caracteres.':primeiroAcesso?'Você será o proprietário da primeira empresa.':modo==='cadastro'?'Cadastre sua empresa e confirme o e-mail para entrar.':'Entre para acessar seus projetos e orçamentos.'}</p>
        {(primeiroAcesso||modo==='cadastro') && <label>Seu nome<input autoComplete="name" required maxLength="120" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Como devemos chamar você?" /></label>}
        {modo==='cadastro'&&<><label>CPF ou CNPJ<input inputMode="numeric" required value={form.documento} onChange={e=>setForm({...form,documento:e.target.value})} placeholder="Somente números ou formatado" /></label><label>Nome da empresa<input required maxLength="120" value={form.empresa} onChange={e=>setForm({...form,empresa:e.target.value})} placeholder="Nome da sua empresa" /></label></>}
        {modo==='cadastro' && <label>Ramo de atividade<select value={form.segmento} onChange={e=>setForm({...form,segmento:e.target.value,atividade:e.target.value==='outros'?form.atividade:''})}><option value="outros">Outros ramos</option><option value="serralheria">Serralheria e solda</option><option value="comercio">Comércio</option><option value="servicos">Prestação de serviços</option><option value="marcenaria">Marcenaria</option></select></label>}
        {modo==='cadastro' && form.segmento === 'outros' && <label>Qual é o ramo da sua empresa?<input required maxLength="200" value={form.atividade} onChange={e=>setForm({...form,atividade:e.target.value})} placeholder="Ex.: vidraçaria, estética automotiva, costura…" /></label>}
        {(primeiroAcesso||modo==='cadastro'||modo==='esqueci'||modo==='reenviar') ? <label>E-mail<input type="email" autoComplete="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="voce@empresa.com.br" /></label>
          : modo==='login'&&<label>Usuário ou e-mail<input autoComplete="username" required value={form.identificador} onChange={e => setForm({ ...form, identificador: e.target.value })} placeholder="Seu usuário" /></label>}
        {!['esqueci','reenviar','confirmar'].includes(modo)&&<label>Senha<input type="password" autoComplete={(primeiroAcesso||modo==='cadastro'||modo==='redefinir') ? 'new-password' : 'current-password'} required minLength={(primeiroAcesso||modo==='cadastro'||modo==='redefinir') ? 10 : 1} maxLength="200" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} placeholder={(primeiroAcesso||modo==='cadastro'||modo==='redefinir') ? 'Mínimo de 10 caracteres' : 'Sua senha'} /></label>}
        {estado.erro && <div className="login-erro" role="alert">{estado.erro}</div>}
        {sucesso&&<div className="login-sucesso" role="status">{sucesso}</div>}
        {modo!=='confirmar' && <button className="login-botao" disabled={estado.enviando || primeiroAcesso === null}>{estado.enviando ? 'Aguarde…' : primeiroAcesso||modo==='cadastro'?'Criar cadastro':modo==='reenviar'?'Reenviar confirmação':modo==='esqueci'?'Enviar recuperação':modo==='redefinir'?'Salvar nova senha':'Entrar no painel'}<span>→</span></button>}
        {!primeiroAcesso&&<div className="login-acoes">{modo==='login'?<><button type="button" onClick={()=>{setModo('esqueci');setSucesso('');setEstado({enviando:false,erro:''})}}>Esqueci minha senha</button><button type="button" onClick={()=>{setModo('cadastro');setSucesso('');setEstado({enviando:false,erro:''})}}>Criar cadastro</button></>:<button type="button" onClick={()=>{setModo('login');setSucesso('');setEstado({enviando:false,erro:''})}}>Voltar ao login</button>}</div>}
        {!primeiroAcesso && modo==='login' && <div className="login-acoes"><button type="button" disabled={estado.enviando} onClick={()=>{setModo('reenviar');setSucesso('');setEstado({enviando:false,erro:''});}}>Não recebi o e-mail de confirmação</button></div>}
        <p className="login-seguranca">Sua senha é armazenada de forma protegida e nunca aparece no painel.</p>
      </form>
    </section>
  </main>;
}
