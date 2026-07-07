/**
 * Test Generation Page
 * Dedicated page for AI-powered test case generation
 */
import TestGeneration from '../components/test-generation/TestGeneration';

const TestGenerationPage = () => {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 font-serif">AI Test Generation</h1>
        <p className="text-gray-600 mt-2">
          Transform your tickets into comprehensive test cases using our 5-agent AI pipeline
        </p>
      </div>
      <TestGeneration />
    </div>
  );
};

export default TestGenerationPage;
