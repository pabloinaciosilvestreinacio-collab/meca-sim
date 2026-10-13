// Editor Java local/offline: realce e sugestões não substituem os erros reais do javac.
export const JAVA_TERMS=Object.freeze([
  'abstract','boolean','break','byte','case','catch','char','class','continue','default',
  'do','double','else','enum','extends','false','final','finally','float','for',
  'if','implements','import','instanceof','int','interface','long','new','null',
  'package','private','protected','public','return','short','static','super',
  'switch','synchronized','this','throw','throws','true','try','void','while',
  'LinearOpMode','Autonomous','TeleOp','DcMotor','DcMotorEx','IMU','Servo',
  'hardwareMap','gamepad1','gamepad2','telemetry','waitForStart','opModeIsActive',
  'isStopRequested','idle','sleep','setPower','getCurrentPosition','setDirection',
  'setMode','resetYaw','getRobotYawPitchRollAngles','getYaw','addData','addLine',
  'update','left_stick_y','left_stick_x','right_stick_x','right_stick_y',
  'left_bumper','right_bumper','left_trigger','right_trigger','RUN_WITHOUT_ENCODER',
  'RUN_USING_ENCODER','STOP_AND_RESET_ENCODER','RUN_TO_POSITION'
]);
const KEYWORDS=new Set(JAVA_TERMS.slice(0,46));
export function candidates(text,cursor,forced=false){
  const match=text.slice(0,cursor).match(/[A-Za-z_$][\w$]*$/);
  const prefix=match?.[0]||'';
  if(prefix.length<(forced?1:3))return [];
  return JAVA_TERMS.filter(item=>item!==prefix&&item.toLowerCase().startsWith(prefix.toLowerCase())).slice(0,7);
}
export function diagnostics(logs){
  const result=[];
  for(const m of String(logs).matchAll(/(?:^|\n)([^\n]*?\.java):(\d+): (error|warning): ([^\n]+)/g)){
    result.push({file:m[1].split(/[\\/]/).pop(),line:Number(m[2]),severity:m[3],message:m[4]});
    if(result.length>=20)break;
  }
  return result;
}
export function escapeHTML(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
export function highlightJava(source){
  const token=/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:0x[\dA-Fa-f]+|\d+(?:\.\d+)?)\b|\b[A-Za-z_$][\w$]*\b)/g;
  let out='',i=0,m;
  while((m=token.exec(source))){
    out+=escapeHTML(source.slice(i,m.index));const s=m[0];let kind='';
    if(s.startsWith('//')||s.startsWith('/*'))kind='cm';
    else if(s[0]==='"'||s[0]==="'")kind='str';
    else if(/^\d/.test(s))kind='num';
    else if(KEYWORDS.has(s))kind='kw';
    else if(['DcMotor','IMU','LinearOpMode','TeleOp','Autonomous'].includes(s))kind='type';
    out+=kind?'<span class="j-'+kind+'">'+escapeHTML(s)+'</span>':escapeHTML(s);i=token.lastIndex;
  }
  return out+escapeHTML(source.slice(i))+'\n';
}
