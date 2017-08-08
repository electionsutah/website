---
layout: page
title: San Juan County
permalink: /places/san-juan/
comments: true
---

<!-- <section class="notice">
  <p>{{ site.data.places.utah_county.wikipedia_snippet }} (<a href="{{ site.data.places.utah_county.wikipedia_url }}"><span>Wikipedia</span></a>)</p>
</section> -->

### 2017 3rd Congressional District Special Election

<aside class="notice">
  <h4>Election Deadlines</h4>
  <ul>
    <li><strong><i class="fa fa-check-square"></i>&nbsp; Friday, 26 May 2017</strong> - Candidate Filing</li>
    <li><strong><i class="fa fa-check-square"></i>&nbsp; Monday, 12 June 2017</strong> - Signature Deadline</li>
    <li><strong>Tuesday, 15 August 2017</strong> - Special Primary; polling hours reportedly 7:00a-8:00p MDT (1300-0200 UTC)</li>
    <li><strong>Friday, 8 September 2017</strong> - Filing Deadline Write-in Candidates</li>
    <li><strong>Tuesday, 7 November 2017</strong> - Special Election; polling hours reportedly 7:00a-8:00p MST (1400-0300 UTC)</li>
  </ul>
</aside>

### 2017 Municipal Election

<aside class="notice">
  <h4>Election Deadlines</h4>
  <ul>
    <li><strong><i class="fa fa-check-square"></i>&nbsp; Wednesday, 7 June 2017</strong> - Candidate Filing</li>
    <li><strong>August 15, 2017</strong> - Primary Election</li>
    <li><strong>November 7, 2017</strong> - General Election</li>
  </ul>
</aside>

### 2017 Primary Candidates
{% assign county = site.data.2017.primary.candidates | where:'county','San Juan' | sort:'name' %}
<table>
<thead>
  <th>Name</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in county  %}
  <tr>
    <td><a href="../../people/{{member.id}}">{{member.name}}</a></td>
    <td>{{ member.body }}</td>
    <td><a href="../../places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="../../places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>