// Supabase 연결 설정.
//
// 아래 두 값을 채우면 Supabase에 저장되고, 휴대폰·PC에서 같은 내역을 봅니다.
// 비워 두면 이 브라우저(localStorage)에만 저장되는 "로컬 저장 모드"로 동작합니다.
//
// 값 찾는 곳: Supabase 대시보드 > Project Settings > API
//   SUPABASE_URL      = Project URL            (예: https://abcdefgh.supabase.co)
//   SUPABASE_ANON_KEY = Project API keys > anon public
//
// anon 키는 공개되어도 되는 키지만, 이 앱은 로그인 없이 쓰므로
// 배포 URL을 아는 사람은 내역을 읽고 쓸 수 있습니다. URL을 공유하지 마세요.

export const SUPABASE_URL = 'https://secqbdcobmqocznsbftm.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_KG-2wV1moYXPlfnBDJwrFg_o-AbrmqX';
