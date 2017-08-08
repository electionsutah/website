---
layout: page
title: Salt Lake County
permalink: /places/salt-lake/
comments: true
---

<div class="columns">
<ul>
  <li><a href="alta">Alta</a></li>
  <li><a href="bluffdale">Bluffdale</a></li>
  <li><a href="cottonwood-heights">Cottonwood Heights</a></li>
  <li><a href="draper">Draper</a></li>
  <li><a href="herriman">Herriman</a></li>
  <li><a href="holladay">Holladay</a></li>
  <li><a href="midvale">Midvale</a></li>
  <li><a href="millcreek">Millcreek</a></li>
  <li><a href="murray">Murray</a></li>
  <li><a href="riverton">Riverton</a></li>
  <li><a href="salt-lake-city">Salt Lake City</a></li>
  <li><a href="sandy">Sandy</a></li>
  <li><a href="south-jordan">South Jordan</a></li>
  <li><a href="south-salt-lake">South Salt Lake</a></li>
  <li><a href="taylorsville">Taylorsville</a></li>
  <li><a href="west-jordan">West Jordan</a></li>
  <li><a href="west-valley-city">West Valley City</a></li>
</ul>
</div>

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

{% include 2017-municipal-election.html %}

### 2017 Primary Candidates
{% assign county = site.data.2017.primary.candidates | where:'county','Salt Lake' | sort:'name' %}
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

<!-- {% assign county = site.data.2017.primary.candidates | where:'county','Salt Lake' | sort:'name' %}
{% for member in county  %}
- <strong>[{{member.name }}](../../people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>[{{ member.city }}](../../places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}), [{{ member.county }}](../../places/{{ member.county | downcase | replace: ' ','-' }}), [{{ member.state }}](../../places)</strong>
{% endfor %} -->
