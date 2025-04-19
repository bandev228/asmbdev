import { useMemo } from 'react';

interface AIContextConfig {
  temperature?: number;
  maxTokens?: number;
  topK?: number;
  topP?: number;
}

// Thông tin cơ bản về Viện
const INSTITUTE_INFO = {
  name: 'Viện Đào tạo công nghệ thông tin, chuyển đổi số',
  shortName: 'VĐTCNTT,CĐS',
  establishment: 'Tháng 7 năm 2024',
  university: 'Trường Đại học Thủ Dầu Một',
  contact: {
    address: 'Số 06, Trần Văn Ơn, Phú Hòa, Thủ Dầu Một, Bình Dương',
    phone: '(0274) 3834512 (Ext 102)',
    email: 'vcntt@tdmu.edu.vn',
    website: 'vcntt.tdmu.edu.vn',
    youtube: 'https://www.youtube.com/ITDT-TDMU'
  }
};

// Thông tin về chương trình đào tạo
const EDUCATION_PROGRAMS = {
  undergraduate: 'Đào tạo nguồn nhân lực CNTT có phẩm chất đạo đức tốt, kiến thức và năng lực chuyên sâu',
  graduate: 'Ngành Hệ thống Thông tin',
  shortTerm: 'Đào tạo và sát hạch chứng chỉ ứng dụng CNTT cơ bản, nâng cao và quốc tế'
};

// Cơ cấu tổ chức
const ORGANIZATION_STRUCTURE = [
  'Chi bộ Đảng, Công đoàn và Đoàn Thanh niên',
  'Hội đồng Khoa học và Đào tạo',
  'Ban lãnh đạo Viện: Viện trưởng và các Phó Viện trưởng',
  'Các Bộ môn: Công nghệ Thông tin, Hệ thống Thông tin'
];

export const useAIContext = (config?: AIContextConfig) => {
  const defaultConfig: AIContextConfig = {
    temperature: 0.7,
    maxTokens: 2048,
    topK: 20,
    topP: 0.9,
    ...config
  };

  const baseContext = useMemo(() => {
    return {
      institute: INSTITUTE_INFO,
      education: EDUCATION_PROGRAMS,
      organization: ORGANIZATION_STRUCTURE
    };
  }, []);

  const generatePrompt = (userInput: string) => {
    return `Bạn là một trợ lý AI thông minh và thân thiện, chuyên hỗ trợ sinh viên tại ${INSTITUTE_INFO.name} trực thuộc ${INSTITUTE_INFO.university}. Hãy trả lời câu hỏi sau một cách chuyên nghiệp, dễ hiểu và phù hợp với bối cảnh sinh viên:

Bối cảnh: Sinh viên đang cần được tư vấn và hỗ trợ về các vấn đề liên quan đến học tập, hoạt động trong trường.

Thông tin về Viện:
• Thành lập: ${INSTITUTE_INFO.establishment}
• Chức năng: ${EDUCATION_PROGRAMS.undergraduate}
• Cơ cấu tổ chức:
${ORGANIZATION_STRUCTURE.map(item => `  - ${item}`).join('\n')}

Chương trình đào tạo:
• Hệ đại học: ${EDUCATION_PROGRAMS.undergraduate}
• Hệ thạc sĩ: ${EDUCATION_PROGRAMS.graduate}
• Đào tạo ngắn hạn: ${EDUCATION_PROGRAMS.shortTerm}

Thông tin liên hệ:
• Địa chỉ: ${INSTITUTE_INFO.contact.address}
• Điện thoại: ${INSTITUTE_INFO.contact.phone}
• Email: ${INSTITUTE_INFO.contact.email}
• Website: ${INSTITUTE_INFO.contact.website}

Yêu cầu khi trả lời:
1. Trả lời ngắn gọn, súc tích nhưng đầy đủ thông tin
2. Sử dụng ngôn ngữ thân thiện, dễ hiểu
3. Nếu không chắc chắn về thông tin, hãy nói rõ và đề xuất cách tìm hiểu thêm
4. Nếu câu hỏi liên quan đến quy định cụ thể của trường, hãy đề xuất sinh viên liên hệ với phòng/khoa phù hợp
5. Tập trung vào việc đưa ra hướng dẫn và giải pháp thực tế
6. Nếu cần thông tin chi tiết hơn, hãy hướng dẫn sinh viên truy cập website hoặc liên hệ trực tiếp

Câu hỏi của sinh viên: ${userInput}`;
  };

  return {
    baseContext,
    generatePrompt,
    config: defaultConfig
  };
}; 

export default useAIContext;
