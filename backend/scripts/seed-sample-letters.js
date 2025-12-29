#!/usr/bin/env node

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { config } from 'dotenv'

config()

const TABLE_NAME = process.env.TABLE_NAME || 'HoldThatThought'
const AWS_REGION = process.env.PUBLIC_AWS_REGION || 'us-east-1'

const client = new DynamoDBClient({ region: AWS_REGION })
const docClient = DynamoDBDocumentClient.from(client)

const sampleLetters = [
  {
    date: '1952-06-15',
    title: 'Summer at the Lake House',
    author: 'Grandma Eleanor',
    content: `Dear Family,

The summer heat has finally arrived, and with it, our annual retreat to the lake house. The children are beside themselves with excitement - little Tommy has already caught three fish, though he let them all go saying they "deserved to swim free."

The garden is flourishing this year. The tomatoes are coming in beautifully, and I've been putting up preserves every afternoon. Your father has been working on the old dock, determined to have it ready for the Fourth of July celebration.

I wanted to write while these moments are fresh. Someday, when the children are grown with families of their own, I hope they'll remember these simple summers - the smell of pine, the sound of loons at dusk, the way the sunlight dances on the water in the early morning.

With all my love,
Mother`,
    description: 'A reflective letter about summer traditions',
  },
  {
    date: '1967-12-24',
    title: 'Christmas Eve Reflections',
    author: 'Grandpa Walter',
    content: `To My Beloved Family,

As I sit by the fire this Christmas Eve, watching the snow fall gently outside, my heart is full of gratitude. This year has brought its challenges, but looking around at all of you gathered here, I am reminded of what truly matters.

Little Sarah asked me today what Christmas was like "in the old days." I told her about the orange in my stocking that felt like the greatest treasure, about singing carols by candlelight, about my mother's apple pie cooling on the windowsill.

But I also told her that the best parts haven't changed - family gathered together, stories shared, love passed down from generation to generation.

May this letter find you all in good health and spirits. Hold tight to each other, for family is the greatest gift we'll ever receive.

Your loving father and grandfather,
Walter`,
    description: 'Christmas Eve letter about family traditions',
  },
  {
    date: '1978-09-03',
    title: 'First Day of College',
    author: 'Uncle Robert',
    content: `Mom and Dad,

Well, I made it! The dorm room is smaller than my closet at home, and my roommate snores like a freight train, but I'm here. College. Can you believe it?

I know you're worried about me being so far from home. I am too, if I'm honest. But walking across campus today, seeing all these people from all over the country, all of us starting something new together - it felt like the beginning of something important.

I promise to call every Sunday (if I can get to the payphone before the line forms). I promise to study hard and make you proud. And I promise that no matter how far I go or how much I learn, I'll never forget where I came from.

Thank you for everything you sacrificed to give me this chance. I won't waste it.

Your son,
Robert

P.S. Please send more of those chocolate chip cookies. They're excellent for making friends.`,
    description: 'First letter home from college',
  },
  {
    date: '1985-04-20',
    title: 'A New Addition',
    author: 'Aunt Margaret',
    content: `Dearest Family,

I'm writing to share the most wonderful news - our baby girl arrived this morning at 7:23 AM. Seven pounds, four ounces, with a shock of dark hair and the most perfect tiny fingers you've ever seen.

We've named her Elizabeth, after grandmother. When I look at her, I can already see the family resemblance - she has her great-grandmother's determined chin and her grandfather's curious eyes.

The doctors say everything went smoothly, and I'm recovering well. David hasn't stopped smiling since he held her for the first time. He's already planning which bedtime stories to read her (starting with all the ones his mother read to him, of course).

There's something profound about becoming a parent - suddenly, you understand your own parents in a way you never could before. All those sleepless nights, all that worry, all that boundless love - now I get it.

We can't wait for you all to meet her.

With overwhelming joy,
Margaret & David`,
    description: 'Birth announcement letter',
  },
  {
    date: '1999-01-01',
    title: 'Letter to the Next Generation',
    author: 'The Family',
    content: `To Our Children and Grandchildren,

As we stand at the threshold of a new millennium, we felt compelled to write this letter - a time capsule of sorts, to be read when another century has passed, or whenever someone in the family needs to remember where they came from.

Our family has weathered wars and depressions, celebrations and sorrows. We've crossed oceans and built homes in new lands. We've argued at dinner tables and reconciled over breakfast. Through it all, we've held onto each other.

What we want you to know is this: You are the continuation of a story that began long before you and will continue long after. Every choice you make, every kindness you show, every dream you chase - it all adds to the tapestry of our family history.

Be good to each other. Forgive quickly. Love deeply. Tell the stories. Keep the traditions, but don't be afraid to start new ones. Remember that wealth is measured not in what you accumulate, but in the lives you touch.

We may not be there to see who you become, but know that we loved you before we ever met you.

With hope for all your tomorrows,
Your Family`,
    description: 'A millennium time capsule letter',
  },
]

async function seedLetters() {
  const now = new Date().toISOString()

  for (const letter of sampleLetters) {
    const item = {
      PK: `LETTER#${letter.date}`,
      SK: 'CURRENT',
      GSI1PK: 'LETTERS',
      GSI1SK: letter.date,
      date: letter.date,
      title: letter.title,
      author: letter.author,
      content: letter.content,
      description: letter.description,
      versionCount: 1,
      createdAt: now,
      updatedAt: now,
      updatedBy: 'seed-script',
    }

    try {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)',
      }))
      console.log(`Created: ${letter.date} - ${letter.title}`)
    }
    catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        console.log(`Exists: ${letter.date} - ${letter.title}`)
      }
      else {
        console.error(`Failed: ${letter.date} - ${error.message}`)
      }
    }
  }

  console.log('\nSeed complete')
}

seedLetters().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
